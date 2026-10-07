import { NextResponse } from 'next/server';
import { trackAnalyticsEvent, type AnalyticsEventType } from '../../../../lib/analytics';
import { boundedRequest, enforceRateLimit, RequestError } from '../../../../lib/request-security';

export const runtime = 'nodejs';

const eventTypes = new Set<AnalyticsEventType>([
  'page_view',
  'contact_section_view',
  'request_bid_submission',
]);

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await (await boundedRequest(request, 16 * 1024)).json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError(400, 'Expected a JSON object');
    for (const value of Object.values(body)) {
      if (typeof value !== 'string' || value.length > 2048) throw new RequestError(400, 'Invalid analytics field');
    }
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventType = clean(body.eventType) as AnalyticsEventType;

  if (!eventTypes.has(eventType)) {
    return NextResponse.json({ ok: false, error: 'Invalid event type' }, { status: 400 });
  }

  try { await enforceRateLimit(request, 'analytics', 120, 60); }
  catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    throw error;
  }

  await trackAnalyticsEvent({
    path: clean(body.path),
    href: clean(body.href),
    referrer: clean(body.referrer),
    utmSource: clean(body.utmSource),
    utmMedium: clean(body.utmMedium),
    utmCampaign: clean(body.utmCampaign),
    eventType,
    deviceType: clean(body.deviceType),
    visitorId: clean(body.visitorId),
  });

  return NextResponse.json({ ok: true });
}
