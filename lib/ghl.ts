/**
 * Minimal GoHighLevel (LeadConnector) API client for server routes.
 * Auth: Private Integration token in GHL_API_KEY, sub-account in GHL_LOCATION_ID. Never log the token.
 */
const API_BASE = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';
const TIMEOUT_MS = 15000;

export class GhlError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'GhlError';
    this.status = status;
    this.body = body;
  }
}

export function ghlConfig(): { token: string; locationId: string } | null {
  const token = process.env.GHL_API_KEY?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  if (!token || !locationId) return null;
  return { token, locationId };
}

function requireConfig() {
  const cfg = ghlConfig();
  if (!cfg) throw new Error('GHL_API_KEY / GHL_LOCATION_ID not configured');
  return cfg;
}

async function ghlFetch<T = any>(method: string, path: string, body?: unknown | FormData): Promise<T> {
  const { token } = requireConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Version: API_VERSION,
    Accept: 'application/json',
  };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new GhlError(`GHL ${method} ${path.split('?')[0]} failed: ${res.status}`, res.status, text.slice(0, 800));
  }
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return {} as T;
  }
}

export interface GhlContactInput {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  companyName?: string;
  source?: string;
  tags?: string[];
  customFields?: { id?: string; key?: string; field_value: string }[];
}

/** Create-or-update by email/phone (respects the location's duplicate settings). */
export async function upsertContact(input: GhlContactInput): Promise<{ id: string; isNew: boolean }> {
  const { locationId } = requireConfig();
  const body = Object.fromEntries(Object.entries({ ...input, locationId }).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)));
  const data = await ghlFetch<{ new?: boolean; contact?: { id: string } }>('POST', '/contacts/upsert', body);
  if (!data.contact?.id) throw new Error('GHL upsert returned no contact id');
  // upsert can replace tags on an existing contact; add them explicitly so they always stick
  if (input.tags?.length) {
    await ghlFetch('POST', `/contacts/${data.contact.id}/tags`, { tags: input.tags }).catch((e) => console.error('[ghl] add tags failed', e?.message, e?.body));
  }
  return { id: data.contact.id, isNew: Boolean(data.new) };
}

export async function addContactNote(contactId: string, body: string): Promise<string | undefined> {
  const data = await ghlFetch<{ note?: { id: string } }>('POST', `/contacts/${contactId}/notes`, { body: body.slice(0, 60000) });
  return data.note?.id;
}

/** Upload a file to the location's Media Storage; returns a public URL usable as a message attachment. */
export async function uploadMedia(file: Blob, name: string): Promise<{ fileId?: string; url: string }> {
  const form = new FormData();
  form.append('file', file, name);
  form.append('name', name);
  form.append('hosted', 'false');
  const data = await ghlFetch<{ fileId?: string; url?: string }>('POST', '/medias/upload-file', form);
  if (!data.url) throw new Error('GHL media upload returned no url');
  return { fileId: data.fileId, url: data.url };
}

/** Fallback upload through Conversations (needs a conversation for the contact). */
export async function uploadConversationAttachment(contactId: string, file: Blob, name: string): Promise<string> {
  const { locationId } = requireConfig();
  const conversationId = await getOrCreateConversation(contactId);
  const form = new FormData();
  form.append('conversationId', conversationId);
  form.append('locationId', locationId);
  form.append('fileAttachment', file, name);
  const data = await ghlFetch<{ uploadedFiles?: Record<string, string> }>('POST', '/conversations/messages/upload', form);
  const url = data.uploadedFiles && Object.values(data.uploadedFiles)[0];
  if (!url) throw new Error('GHL conversation upload returned no url');
  return url;
}

export async function getOrCreateConversation(contactId: string): Promise<string> {
  const { locationId } = requireConfig();
  const found = await ghlFetch<{ conversations?: { id: string }[] }>('GET', `/conversations/search?locationId=${locationId}&contactId=${contactId}&limit=1`);
  if (found.conversations?.[0]?.id) return found.conversations[0].id;
  const created = await ghlFetch<{ conversation?: { id: string }; id?: string }>('POST', '/conversations/', { locationId, contactId });
  const id = created.conversation?.id || created.id;
  if (!id) throw new Error('GHL conversation create returned no id');
  return id;
}

export interface SendResult {
  conversationId?: string;
  messageId?: string;
}

/**
 * Sender for outgoing emails, from GHL_EMAIL_FROM (e.g. "Vulpine <team@vulpine.llc>"). Unset = the location's
 * default sender. Only set it once that domain is a verified dedicated sending domain in GHL; GHL otherwise
 * falls back to the default sender anyway.
 */
export function defaultEmailFrom(): string | undefined {
  return process.env.GHL_EMAIL_FROM?.trim() || undefined;
}

export async function sendEmail(opts: { contactId: string; subject: string; html: string; attachments?: string[]; emailTo?: string; emailFrom?: string }): Promise<SendResult> {
  const base: Record<string, unknown> = { type: 'Email', contactId: opts.contactId, subject: opts.subject, html: opts.html };
  if (opts.attachments?.length) base.attachments = opts.attachments;
  if (opts.emailTo) base.emailTo = opts.emailTo;
  const from = opts.emailFrom ?? defaultEmailFrom();
  // try "Name <addr>", then the bare address, then the location default, so a rejected sender never blocks the email
  const bare = from?.match(/<([^>]+)>/)?.[1]?.trim();
  const candidates = [from, bare && bare !== from ? bare : undefined, from ? null : undefined].filter((c) => c !== undefined) as (string | null)[];
  if (!candidates.length) candidates.push(null);
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const data = await ghlFetch<SendResult>('POST', '/conversations/messages', candidate ? { ...base, emailFrom: candidate } : base);
      return { conversationId: data.conversationId, messageId: data.messageId };
    } catch (e) {
      lastError = e;
      // only a 4xx (bad request / sender rejected) is worth retrying with a different sender
      if (!(e instanceof GhlError) || e.status < 400 || e.status >= 500 || e.status === 401) throw e;
      console.error('[ghl] email send rejected with sender', candidate ?? '(default)', e.status, e.body);
    }
  }
  throw lastError;
}

export async function sendSms(opts: { contactId: string; message: string }): Promise<SendResult> {
  const data = await ghlFetch<SendResult>('POST', '/conversations/messages', { type: 'SMS', contactId: opts.contactId, message: opts.message });
  return { conversationId: data.conversationId, messageId: data.messageId };
}

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; position?: number }[];
}

/**
 * Picks the pipeline/stage for new configurator leads.
 * GHL_PIPELINE_ID / GHL_PIPELINE_STAGE_ID override; otherwise the first pipeline whose name mentions
 * refacing/residential/lead/sales/marketing, and its "new"/"lead" stage (else the first stage).
 */
export async function resolvePipelineStage(): Promise<{ pipelineId: string; pipelineName: string; stageId: string; stageName: string }> {
  const { locationId } = requireConfig();
  const data = await ghlFetch<{ pipelines?: Pipeline[] }>('GET', `/opportunities/pipelines?locationId=${locationId}`);
  const pipelines = data.pipelines || [];
  if (!pipelines.length) throw new Error('No GHL pipelines in this location');
  const wantPipeline = process.env.GHL_PIPELINE_ID?.trim();
  const rank = (name: string) => {
    const n = name.toLowerCase();
    return ['reface', 'refacing', 'residential', 'configurator', 'lead', 'sales', 'marketing'].findIndex((k) => n.includes(k));
  };
  const pipeline =
    pipelines.find((p) => p.id === wantPipeline) ||
    [...pipelines].sort((a, b) => {
      const ra = rank(a.name);
      const rb = rank(b.name);
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
    })[0];
  const stages = [...(pipeline.stages || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const wantStage = process.env.GHL_PIPELINE_STAGE_ID?.trim();
  const stage = stages.find((s) => s.id === wantStage) || stages.find((s) => /\bnew\b|lead/i.test(s.name)) || stages[0];
  if (!stage) throw new Error(`GHL pipeline ${pipeline.name} has no stages`);
  return { pipelineId: pipeline.id, pipelineName: pipeline.name, stageId: stage.id, stageName: stage.name };
}

export async function createOpportunity(opts: { contactId: string; name: string; pipelineId: string; stageId: string; source?: string }): Promise<{ id: string; existing: boolean }> {
  const { locationId } = requireConfig();
  // reuse an open opportunity for this contact in the same pipeline (repeat submissions)
  try {
    const found = await ghlFetch<{ opportunities?: { id: string; status?: string }[] }>(
      'GET',
      `/opportunities/search?location_id=${locationId}&contact_id=${opts.contactId}&pipeline_id=${opts.pipelineId}&status=open&limit=1`,
    );
    const existing = found.opportunities?.[0]?.id;
    if (existing) {
      await ghlFetch('PUT', `/opportunities/${existing}`, { name: opts.name }).catch(() => undefined);
      return { id: existing, existing: true };
    }
  } catch (e: any) {
    console.error('[ghl] opportunity search failed', e?.message, e?.body);
  }
  const data = await ghlFetch<{ opportunity?: { id: string } }>('POST', '/opportunities/', {
    locationId,
    contactId: opts.contactId,
    name: opts.name.slice(0, 200),
    pipelineId: opts.pipelineId,
    pipelineStageId: opts.stageId,
    status: 'open',
    source: opts.source,
  });
  if (!data.opportunity?.id) throw new Error('GHL opportunity create returned no id');
  return { id: data.opportunity.id, existing: false };
}

export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

/** E.164 for US numbers; leaves anything else as typed. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.trim();
}
