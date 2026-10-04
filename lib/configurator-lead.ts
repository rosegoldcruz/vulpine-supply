/**
 * Configurator quote -> GoHighLevel: contact (tags + note), design summary PDF, media uploads,
 * customer email (or SMS link), owner copy, opportunity, activity notes.
 * Every step is best-effort: failures are logged and reported, never thrown to the caller.
 */
import { parseConfig, type ConfigSelection } from '@/components/configurator/summary';
import { renderDesignSummaryPdf, SITE, type AssetSource, type DesignDetails } from './design-summary-pdf';
import {
  addContactNote,
  createOpportunity,
  ghlConfig,
  normalizePhone,
  resolvePipelineStage,
  sendEmail,
  sendSms,
  splitName,
  upsertContact,
  uploadConversationAttachment,
  uploadMedia,
} from './ghl';

export const OWNER_EMAIL = process.env.GHL_OWNER_EMAIL?.trim() || 'info@vulpine.llc';
const OWNER_CONTACT_NAME = 'Vulpine Team (internal)';
const LEAD_TAGS = ['configurator', 'refacing-lead'];

export interface ConfiguratorLeadInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  message?: string;
  source?: string;
  pageUrl?: string;
  smsConsent?: boolean;
  /** configurator query string (style=...&color=...) */
  config: string;
  photos?: { name: string; type: string; data: ArrayBuffer }[];
  utm?: Record<string, string>;
  extraTags?: string[];
}

export interface ConfiguratorLeadResult {
  ok: boolean;
  ref?: string;
  contactId?: string;
  ownerContactId?: string;
  opportunityId?: string;
  pipeline?: string;
  stage?: string;
  pdfUrl?: string;
  photoUrls: string[];
  customerMessage?: { channel: 'email' | 'sms'; messageId?: string; conversationId?: string };
  ownerMessage?: { messageId?: string; conversationId?: string };
  pdfBytes?: number;
  errors: string[];
}

/**
 * Finds a configurator design in a submission: explicit `config` field, else a /configurator or
 * /configurator/summary link in the message, else the page URL. Returns null for non-configurator leads.
 */
export function extractConfigQuery(raw: { config?: string; message?: string; pageUrl?: string; projectType?: string }): string | null {
  const hasStyle = (q: string) => /(^|&)style=/.test(q);
  const explicit = (raw.config || '').trim().replace(/^\?/, '');
  if (explicit && hasStyle(explicit)) return explicit;
  const fromText = (raw.message || '').match(/\/configurator(?:\/summary)?\?([^\s"'<>]+)/);
  if (fromText && hasStyle(fromText[1])) return fromText[1];
  let onConfigurator = false;
  try {
    const u = new URL(raw.pageUrl || '');
    onConfigurator = u.pathname.startsWith('/configurator');
    if (onConfigurator && u.searchParams.get('style')) return u.searchParams.toString();
  } catch {
    /* no page url */
  }
  // configurator lead without a readable design: fall back to the default design
  return onConfigurator || /configurator/i.test(raw.projectType || '') ? '' : null;
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function phoenixTime(d = new Date()) {
  return `${d.toLocaleString('en-US', { timeZone: 'America/Phoenix', dateStyle: 'medium', timeStyle: 'short' })} AZ`;
}

function designLines(d: DesignDetails) {
  return [
    `Reference: ${d.ref}`,
    `Door style: ${d.styleName}`,
    `Color: ${d.colorName}`,
    `Hardware: ${d.hardwareName}`,
    `Hardware finish: ${d.finishName}`,
    `Doors use: ${d.doorsLabel.toLowerCase()}`,
    `Design link: ${d.designUrl}`,
    `Design summary: ${d.summaryUrl}`,
  ];
}

function customerEmailHtml(first: string, d: DesignDetails, pdfUrl?: string) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#888480;font-size:13px;width:140px">${esc(k)}</td><td style="padding:6px 0;font-weight:600;font-size:14px">${esc(v)}</td></tr>`;
  return `<div style="font-family:Helvetica,Arial,sans-serif;color:#111111;max-width:560px;line-height:1.55">
<p style="font-size:22px;font-weight:800;letter-spacing:-0.5px;margin:0 0 18px">Vulpine<span style="color:#ee7200">.</span></p>
<p>Hi ${esc(first || 'there')},</p>
<p>Thanks for designing your kitchen with Vulpine! Your design summary is attached as a PDF. Here's what you picked:</p>
<table style="border-collapse:collapse;margin:8px 0 16px">${row('Reference', d.ref)}${row('Door style', d.styleName)}${row('Color', d.colorName)}${row('Hardware', `${d.hardwareName}, ${d.finishName}`)}${row('Doors', d.doorsLabel)}</table>
<p><a href="${esc(d.designUrl)}" style="display:inline-block;background:#ee7200;color:#ffffff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:999px">Open your design</a></p>
${pdfUrl ? `<p style="font-size:13px;color:#888480">Can't see the attachment? <a href="${esc(pdfUrl)}" style="color:#ee7200">Download your design summary</a>.</p>` : ''}
<p>A member of our team will reach out shortly to confirm measurements, quantities and lead time for your custom quote. Just reply to this email if you have questions or want to tweak anything.</p>
<p>Talk soon,<br/>The Vulpine Homes team<br/><span style="color:#888480;font-size:13px">(480) 267-9181 · info@vulpine.llc · vulpinehomes.com</span></p>
</div>`;
}

function ownerEmailHtml(input: ConfiguratorLeadInput, d: DesignDetails, r: ConfiguratorLeadResult) {
  const row = (k: string, v?: string) => (v ? `<tr><td style="padding:4px 12px 4px 0;color:#888480">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>` : '');
  const crm = r.contactId ? `https://app.gohighlevel.com/v2/location/${ghlConfig()?.locationId}/contacts/detail/${r.contactId}` : '';
  return `<div style="font-family:Helvetica,Arial,sans-serif;color:#111111;line-height:1.5">
<p style="font-size:18px;font-weight:800">New configurator quote request · ${esc(d.ref)}</p>
<table style="border-collapse:collapse">${row('Name', input.name)}${row('Email', input.email)}${row('Phone', input.phone)}${row('Address', input.address)}${row('SMS consent', input.smsConsent ? 'Yes' : 'No')}${row('Source', input.source)}${row('Submitted', phoenixTime())}</table>
<p style="font-weight:700;margin-top:14px">Design</p>
<table style="border-collapse:collapse">${row('Door style', d.styleName)}${row('Color', d.colorName)}${row('Hardware', `${d.hardwareName}, ${d.finishName}`)}${row('Doors', d.doorsLabel)}</table>
<p><a href="${esc(d.designUrl)}">Open the design</a> · <a href="${esc(d.summaryUrl)}">Design summary</a>${r.pdfUrl ? ` · <a href="${esc(r.pdfUrl)}">PDF</a>` : ''}${crm ? ` · <a href="${esc(crm)}">Contact in GHL</a>` : ''}</p>
${r.photoUrls.length ? `<p style="font-weight:700">Photos (${r.photoUrls.length})</p><p>${r.photoUrls.map((u, i) => `<a href="${esc(u)}">Photo ${i + 1}</a>`).join(' · ')}</p>` : ''}
${input.message ? `<p style="font-weight:700">Message</p><pre style="font-family:inherit;white-space:pre-wrap;margin:0">${esc(input.message)}</pre>` : ''}
<p style="color:#888480;font-size:12px">Customer copy: ${r.customerMessage ? `sent by ${r.customerMessage.channel}` : 'not sent'}. Sent automatically by vulpinehomes.com.</p>
</div>`;
}

export async function processConfiguratorLead(input: ConfiguratorLeadInput, assets: AssetSource = {}): Promise<ConfiguratorLeadResult> {
  const r: ConfiguratorLeadResult = { ok: false, photoUrls: [], errors: [] };
  const fail = (step: string, e: any) => {
    const msg = `${step}: ${e?.message || e}${e?.body ? ` ${String(e.body).slice(0, 300)}` : ''}`;
    r.errors.push(msg);
    console.error('[configurator-lead]', msg);
  };
  if (!ghlConfig()) {
    fail('config', 'GHL_API_KEY / GHL_LOCATION_ID not set; skipped GoHighLevel');
    return r;
  }

  const sel: ConfigSelection = parseConfig(new URLSearchParams(input.config || ''));
  const { firstName, lastName } = splitName(input.name);
  const phone = input.phone ? normalizePhone(input.phone) : undefined;

  // 1) PDF first so the contact note can carry its details even if uploads fail
  let pdf: Buffer | null = null;
  let d: DesignDetails;
  try {
    const out = await renderDesignSummaryPdf(sel, { preparedFor: input.name, assets });
    pdf = out.pdf;
    d = out.details;
    r.pdfBytes = pdf.length;
  } catch (e) {
    fail('pdf', e);
    d = (await import('./design-summary-pdf')).designDetails(sel);
  }
  r.ref = d.ref;

  // 2) contact
  try {
    const c = await upsertContact({
      firstName,
      lastName,
      name: input.name,
      email: input.email || undefined,
      phone,
      address1: input.address || undefined,
      source: 'Vulpine configurator',
      tags: [...LEAD_TAGS, ...(input.extraTags || [])],
    });
    r.contactId = c.id;
  } catch (e) {
    fail('contact', e);
    return r; // nothing else can attach without a contact
  }
  const contactId = r.contactId!;

  // 3) uploads: PDF + photos (media library, fallback to conversation upload)
  const upload = async (blob: Blob, name: string) => {
    try {
      return (await uploadMedia(blob, name)).url;
    } catch (e) {
      fail(`media upload ${name}`, e);
      try {
        return await uploadConversationAttachment(contactId, blob, name);
      } catch (e2) {
        fail(`conversation upload ${name}`, e2);
        return undefined;
      }
    }
  };
  const safeName = input.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'customer';
  if (pdf) {
    r.pdfUrl = await upload(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), `Vulpine-Design-Summary-${d.ref}-${safeName}.pdf`);
  }
  for (const [i, ph] of (input.photos || []).entries()) {
    const url = await upload(new Blob([ph.data], { type: ph.type || 'image/jpeg' }), `${d.ref}-${safeName}-photo-${i + 1}.${/png/.test(ph.type) ? 'png' : 'jpg'}`);
    if (url) r.photoUrls.push(url);
  }

  // 4) design + quote note (the "quote submitted" activity)
  try {
    await addContactNote(
      contactId,
      [
        `Configurator quote request submitted (${phoenixTime()})`,
        `Source: ${input.source || 'configurator'}${input.pageUrl ? ` (${input.pageUrl})` : ''}`,
        '',
        ...designLines(d),
        r.pdfUrl ? `Design summary PDF: ${r.pdfUrl}` : 'Design summary PDF: not uploaded',
        ...r.photoUrls.map((u, i) => `Photo ${i + 1}: ${u}`),
        '',
        input.address ? `Property address: ${input.address}` : '',
        `SMS consent: ${input.smsConsent ? 'yes' : 'no'}`,
        input.utm && Object.values(input.utm).some(Boolean) ? `UTM: ${Object.entries(input.utm).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(' ')}` : '',
        input.message ? `\nMessage:\n${input.message}` : '',
      ]
        .filter((l) => l !== null && l !== undefined)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n'),
    );
  } catch (e) {
    fail('note', e);
  }

  // 5) opportunity
  try {
    const ps = await resolvePipelineStage();
    r.pipeline = ps.pipelineName;
    r.stage = ps.stageName;
    const opp = await createOpportunity({
      contactId,
      name: `${input.name} · Refacing ${d.ref} (${d.styleName} ${d.colorName})`,
      pipelineId: ps.pipelineId,
      stageId: ps.stageId,
      source: 'Vulpine configurator',
    });
    r.opportunityId = opp.id;
  } catch (e) {
    fail('opportunity', e);
  }

  // 6) customer copy: email with the PDF, or SMS with the link when there is no email
  const first = firstName;
  try {
    if (input.email) {
      const sent = await sendEmail({
        contactId,
        subject: `Your Vulpine cabinet design summary (${d.ref})`,
        html: customerEmailHtml(first, d, r.pdfUrl),
        attachments: r.pdfUrl ? [r.pdfUrl] : undefined,
      });
      r.customerMessage = { channel: 'email', ...sent };
    } else if (phone) {
      const link = r.pdfUrl || d.summaryUrl;
      const sent = await sendSms({
        contactId,
        message: `Hi ${first || 'there'}, thanks for designing your kitchen with Vulpine! Here's your design summary (${d.ref}): ${link} We'll reach out shortly about your custom quote. Reply STOP to opt out.`,
      });
      r.customerMessage = { channel: 'sms', ...sent };
    }
  } catch (e) {
    fail(`customer ${input.email ? 'email' : 'sms'}`, e);
  }

  // 7) owner copy: internal email with the PDF to info@vulpine.llc (its own internal contact)
  try {
    const owner = await upsertContact({ name: OWNER_CONTACT_NAME, firstName: 'Vulpine', lastName: 'Team (internal)', email: OWNER_EMAIL, tags: ['vulpine-internal'] });
    r.ownerContactId = owner.id;
    r.ownerMessage = await sendEmail({
      contactId: owner.id,
      subject: `New configurator quote: ${input.name} · ${d.ref}`,
      html: ownerEmailHtml(input, d, r),
      attachments: [r.pdfUrl, ...r.photoUrls].filter(Boolean) as string[],
    });
  } catch (e) {
    fail('owner email', e);
  }

  // 8) "PDF sent" activity note
  try {
    const lines = [
      `Design summary PDF sent (${phoenixTime()})`,
      r.customerMessage
        ? `Customer copy: ${r.customerMessage.channel === 'email' ? `emailed to ${input.email}` : `texted link to ${phone}`} (message ${r.customerMessage.messageId || 'n/a'})`
        : 'Customer copy: NOT sent',
      r.ownerMessage ? `Owner copy: emailed to ${OWNER_EMAIL} (message ${r.ownerMessage.messageId || 'n/a'})` : 'Owner copy: NOT sent',
      r.pdfUrl ? `PDF: ${r.pdfUrl}` : '',
      r.opportunityId ? `Opportunity: ${r.opportunityId} (${r.pipeline} / ${r.stage})` : '',
      r.errors.length ? `Errors: ${r.errors.join(' | ').slice(0, 1500)}` : '',
    ];
    await addContactNote(contactId, lines.filter(Boolean).join('\n'));
  } catch (e) {
    fail('sent note', e);
  }

  r.ok = Boolean(r.contactId && r.errors.length === 0);
  console.log('[configurator-lead] done', JSON.stringify({ ref: r.ref, contactId: r.contactId, opportunityId: r.opportunityId, customer: r.customerMessage?.channel, owner: Boolean(r.ownerMessage), errors: r.errors.length }));
  return r;
}

export { SITE };
