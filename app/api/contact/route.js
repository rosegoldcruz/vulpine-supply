export const runtime = 'nodejs';

const SOURCE = 'vulpinehomes.com';
const DEFAULT_STATUS = 'new';
const MAX_STRING_LENGTH = 2000;

const TEXT_FIELDS = [
  'name',
  'email',
  'phone',
  'company',
  'project_type',
  'project_location',
  'address',
  'city',
  'state',
  'zip',
  'message',
  'page_url',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
];

function cleanString(value, maxLength = MAX_STRING_LENGTH) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function firstString(raw, keys) {
  for (const key of keys) {
    const value = cleanString(raw?.[key]);
    if (value) return value;
  }

  return '';
}

function normalizeEmail(value) {
  return cleanString(value, 320).toLowerCase();
}

function normalizePageUrl(value, fallback) {
  const candidate = cleanString(value || fallback, 2048);
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString().slice(0, 2048);
    }
  } catch {
    return '';
  }

  return '';
}

async function readRequestBody(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  return request.json().catch(() => ({}));
}

function normalizePayload(raw, request) {
  const pageUrl = normalizePageUrl(raw?.page_url || raw?.pageUrl, request.headers.get('referer'));

  return {
    source: SOURCE,
    status: DEFAULT_STATUS,
    name: firstString(raw, ['name', 'fullName', 'full_name']),
    email: normalizeEmail(raw?.email),
    phone: firstString(raw, ['phone', 'phone_number']),
    company: firstString(raw, ['company', 'company_name']),
    project_type: firstString(raw, ['project_type', 'projectType']),
    project_location: firstString(raw, ['project_location', 'projectLocation']),
    address: firstString(raw, ['address', 'street_address']),
    city: firstString(raw, ['city']),
    state: firstString(raw, ['state']),
    zip: firstString(raw, ['zip', 'zipcode', 'postal_code']),
    message: firstString(raw, ['message', 'projectDetails', 'project_details']),
    page_url: pageUrl,
    utm_source: firstString(raw, ['utm_source', 'utmSource']),
    utm_medium: firstString(raw, ['utm_medium', 'utmMedium']),
    utm_campaign: firstString(raw, ['utm_campaign', 'utmCampaign']),
    utm_content: firstString(raw, ['utm_content', 'utmContent']),
    utm_term: firstString(raw, ['utm_term', 'utmTerm']),
    crm_synced: false,
    crm_synced_at: null,
    raw_payload: {
      submitted_at: new Date().toISOString(),
      user_agent: request.headers.get('user-agent') || '',
      referer: request.headers.get('referer') || '',
      payload: raw || {},
    },
  };
}

function validatePayload(payload) {
  if (!payload.name) return 'Name is required.';
  if (!payload.email && !payload.phone) return 'Email or phone is required.';
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return 'Enter a valid email address.';
  }
  if (!payload.project_type) return 'Project type is required.';
  if (!payload.message) return 'Project details are required.';
  return '';
}

function validateConfig() {
  const missing = [
    'NOCODB_BASE_URL',
    'NOCODB_API_TOKEN',
    'NOCODB_TABLE_ID',
    'VULPINE_SUPPLY_INTAKE_TOKEN',
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return missing;
  }

  return [];
}

function getNocoDbRecordsUrl() {
  const baseUrl = process.env.NOCODB_BASE_URL.trim().replace(/\/+$/, '');
  const tableId = encodeURIComponent(process.env.NOCODB_TABLE_ID.trim());
  return `${baseUrl}/api/v2/tables/${tableId}/records`;
}

async function createNocoDbRecord(record) {
  const response = await fetch(getNocoDbRecordsUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xc-token': process.env.NOCODB_API_TOKEN,
    },
    body: JSON.stringify([record]),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`NocoDB intake failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  return response.json().catch(() => null);
}

export async function GET() {
  return Response.json({ success: true, message: 'Contact intake endpoint is available.' });
}

export async function POST(request) {
  try {
    const raw = await readRequestBody(request);
    const payload = normalizePayload(raw || {}, request);
    const validationError = validatePayload(payload);

    if (validationError) {
      return Response.json({ success: false, error: validationError }, { status: 400 });
    }

    const missingConfig = validateConfig();
    if (missingConfig.length > 0) {
      console.error('Contact intake is missing required server env vars:', missingConfig.join(', '));
      return Response.json(
        { success: false, error: 'Contact intake is not configured.' },
        { status: 503 }
      );
    }

    const record = Object.fromEntries(TEXT_FIELDS.map((field) => [field, payload[field]]));
    record.source = payload.source;
    record.status = payload.status;
    record.crm_synced = payload.crm_synced;
    record.crm_synced_at = payload.crm_synced_at;
    record.raw_payload = payload.raw_payload;

    const result = await createNocoDbRecord(record);

    return Response.json({ success: true, result });
  } catch (error) {
    console.error('Contact intake submission failed:', error);
    return Response.json(
      { success: false, error: 'Unable to process your request at this time.' },
      { status: 502 }
    );
  }
}
