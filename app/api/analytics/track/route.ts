import { NextResponse } from 'next/server';
import { trackAnalyticsEvent, type AnalyticsEventType } from '../../../../lib/analytics';

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
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventType = clean(body.eventType) as AnalyticsEventType;

  if (!eventTypes.has(eventType)) {
    return NextResponse.json({ ok: false, error: 'Invalid event type' }, { status: 400 });
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