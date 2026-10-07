import { trackAnalyticsEvent } from '../../../lib/analytics';
import { formatBidRequestTelegramMessage, sendTelegramMessage, sendTelegramPhotos } from '../../../lib/telegram';
import { SMS_CONSENT_TEXT } from '../../../lib/sms-consent';
import { after } from 'next/server';
import { extractConfigQuery, processConfiguratorLead } from '../../../lib/configurator-lead';
import { boundedRequest, enforceRateLimit, logFailure, RequestError } from '../../../lib/request-security';

export const runtime = 'nodejs';
// the GoHighLevel hand-off (PDF render, uploads, emails) runs after the response via after()
export const maxDuration = 60;

const SOURCE = 'vulpinehomes.com';
const DEFAULT_STATUS = 'new';
const MAX_STRING_LENGTH = 2000;
// optional project photos (multipart field "photos"), forwarded best-effort to Telegram
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTOS = Symbol('photos');

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

function normalizeSmsConsent(raw) {
  const value = raw?.smsConsent ?? raw?.sms_consent;
  return value === true || value === 'true' || value === 'on' || value === '1';
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
    const raw = Object.create(null);
    const photos = [];
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') raw[key] = value;
      else if (key === 'photos') {
        if (photos.length >= MAX_PHOTOS || !value.size || value.size > MAX_PHOTO_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(value.type)) {
          throw new RequestError(400, 'Use up to five JPEG, PNG or WebP photos, at most 8 MB each.');
        }
        const bytes = new Uint8Array(await value.slice(0, 12).arrayBuffer());
        const valid = value.type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
          : value.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b)
          : String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
        if (!valid) throw new RequestError(400, 'Photo content does not match its file type.');
        photos.push(value);
      }
    }
    if (photos.length) Object.defineProperty(raw, PHOTOS, { value: photos, enumerable: false });
    return raw;
  }

  throw new RequestError(415, 'Unsupported request content type.');
}

function normalizePayload(raw, request) {
  const pageUrl = normalizePageUrl(raw?.page_url || raw?.pageUrl, request.headers.get('referer'));
  const smsConsent = normalizeSmsConsent(raw);

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
    smsConsent,
    smsConsentText: smsConsent ? SMS_CONSENT_TEXT : null,
    smsConsentTimestamp: smsConsent ? new Date().toISOString() : null,
    smsConsentSource: smsConsent ? pageUrl : null,
    crm_synced: false,
    crm_synced_at: null,
    raw_payload: {
      submitted_at: new Date().toISOString(),
      user_agent: cleanString(request.headers.get('user-agent'), 500),
      referer: cleanString(request.headers.get('referer'), 2048),
      payload: Object.fromEntries(TEXT_FIELDS.map((field) => [field, cleanString(raw?.[field])])),
    },
  };
}

function validatePayload(payload) {
  if (!payload.name) return 'Name is required.';
  if (!payload.email && !payload.phone) return 'Email or phone is required.';
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return 'Enter a valid email address.';
  }
  if (payload.phone && (!/^[+\d\s().-]+$/.test(payload.phone) || !/^\d{10,15}$/.test(payload.phone.replace(/\D/g, '')))) {
    return 'Enter a valid phone number.';
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

function getRequestIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    ''
  );
}

function inferLeadSource(source, pageUrl) {
  if (source) return source;

  try {
    const url = new URL(pageUrl);
    if (url.pathname === '/request-bid') return '/request-bid';
    if (url.hash === '#contact') return 'Homepage #contact';
  } catch {
    return 'Unknown';
  }

  return 'Unknown';
}

function buildBidRequestPayload(raw, payload, request) {
  return {
    source: inferLeadSource(cleanString(raw?.source), payload.page_url),
    pageUrl: payload.page_url,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    company: payload.company,
    projectType: payload.project_type,
    projectLocation: payload.project_location,
    projectDetails: payload.message,
    smsConsent: payload.smsConsent,
    userAgent: request.headers.get('user-agent') || '',
    ip: getRequestIp(request),
  };
}

function getAnalyticsPath(pageUrl) {
  try {
    const url = new URL(pageUrl);
    return url.pathname + url.hash;
  } catch {
    return '/';
  }
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
    const bodyLimit = (request.headers.get('content-type') || '').includes('multipart/form-data')
      ? MAX_PHOTOS * MAX_PHOTO_BYTES + 64 * 1024 : 64 * 1024;
    const bounded = await boundedRequest(request, bodyLimit);
    let raw;
    try { raw = await readRequestBody(bounded); }
    catch (error) {
      if (error instanceof RequestError) throw error;
      throw new RequestError(400, 'Invalid request body.');
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new RequestError(400, 'Expected a form or JSON object.');
    for (const [key, value] of Object.entries(raw)) {
      if ((typeof value === 'string' && value.length > (key === 'page_url' || key === 'pageUrl' ? 2048 : MAX_STRING_LENGTH)) ||
          !['string', 'boolean'].includes(typeof value)) throw new RequestError(400, 'Invalid form field.');
    }
    const payload = normalizePayload(raw || {}, request);
    const validationError = validatePayload(payload);

    if (validationError) {
      return Response.json({ success: false, error: validationError }, { status: 400 });
    }

    await enforceRateLimit(request, 'contact', 5, 600);
    await enforceRateLimit(request, 'contact-budget', 100, 600, 'all');
    if (payload.email) await enforceRateLimit(request, 'contact-email', 3, 3600, payload.email);
    if (payload.phone) await enforceRateLimit(request, 'contact-phone', 3, 3600, payload.phone.replace(/\D/g, ''));

    const record = Object.fromEntries(TEXT_FIELDS.map((field) => [field, payload[field]]));
    record.source = payload.source;
    record.status = payload.status;
    record.crm_synced = payload.crm_synced;
    record.crm_synced_at = payload.crm_synced_at;
    record.smsConsent = payload.smsConsent;
    record.smsConsentText = payload.smsConsentText;
    record.smsConsentTimestamp = payload.smsConsentTimestamp;
    record.smsConsentSource = payload.smsConsentSource;
    record.raw_payload = payload.raw_payload;

    const missingConfig = validateConfig();

    if (missingConfig.length > 0) {
      console.error('Contact intake is missing required server env vars:', missingConfig.join(', '));
    } else {
      try {
        await createNocoDbRecord(record);
      } catch (error) {
        logFailure('NocoDB intake sync failed:', error);
      }
    }

    const bidRequestPayload = buildBidRequestPayload(raw || {}, payload, request);

    try {
      await sendTelegramMessage(formatBidRequestTelegramMessage(bidRequestPayload));
    } catch (error) {
      logFailure('Bid Telegram notification failed:', error);
    }

    const photos = raw?.[PHOTOS];
    if (photos?.length) {
      try {
        await sendTelegramPhotos(photos, `Photos from ${payload.name} (${photos.length})`);
      } catch (error) {
        logFailure('Bid photo forwarding failed:', error);
      }
    }

    // Configurator quotes -> GoHighLevel (contact, PDF, customer + owner emails, opportunity).
    // Runs after the response is sent; any GHL failure is logged and never reaches the customer.
    const configQuery = extractConfigQuery({
      config: cleanString(raw?.config || raw?.configuration_query, 1000),
      message: payload.message,
      pageUrl: payload.page_url,
      projectType: payload.project_type,
    });
    let ghl = 'skipped';
    if (configQuery !== null) {
      ghl = 'queued';
      const photoData = [];
      for (const photo of photos || []) {
        try {
          photoData.push({ name: photo.name || 'photo.jpg', type: photo.type || 'image/jpeg', data: await photo.arrayBuffer() });
        } catch (error) {
          logFailure('Bid photo read failed:', error);
        }
      }
      const origin = new URL(request.url).origin;
      const leadInput = {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        address: firstString(raw, ['address', 'street_address']) || payload.project_location,
        message: payload.message,
        source: bidRequestPayload.source,
        pageUrl: payload.page_url,
        smsConsent: payload.smsConsent,
        config: configQuery,
        photos: photoData,
        utm: {
          utm_source: payload.utm_source,
          utm_medium: payload.utm_medium,
          utm_campaign: payload.utm_campaign,
          utm_content: payload.utm_content,
          utm_term: payload.utm_term,
        },
        // clearly marked test submissions get a 'test' tag so they are easy to find and clean up
        extraTags: /^test\b/i.test(payload.name) ? ['test'] : [],
      };
      const cookie = request.headers.get('cookie') || '';
      after(async () => {
        try {
          await processConfiguratorLead(leadInput, { origin, cookie });
        } catch (error) {
          logFailure('Configurator GHL hand-off crashed:', error);
        }
      });
    }

    try {
      await trackAnalyticsEvent({
        eventType: 'request_bid_submission',
        path: getAnalyticsPath(payload.page_url),
        href: payload.page_url,
        referrer: payload.raw_payload.referer,
        utmSource: payload.utm_source,
        utmMedium: payload.utm_medium,
        utmCampaign: payload.utm_campaign,
        deviceType: 'unknown',
      });
    } catch (error) {
      logFailure('Bid analytics tracking failed:', error);
    }

    return Response.json({
      success: true,
      ok: true,
      intakeConfigured: missingConfig.length === 0,
      ghl,
    });
  } catch (error) {
    if (error instanceof RequestError) return Response.json(
      { success: false, error: error.message },
      { status: error.status, ...(error.status === 429 ? { headers: { 'Retry-After': '600' } } : {}) }
    );
    logFailure('Contact intake submission failed:', error);
    return Response.json(
      { success: false, error: 'Unable to process your request at this time.' },
      { status: 502 }
    );
  }
}
