import { NextResponse } from 'next/server';
import { formatTrafficReport, getTrafficReportStats } from '../../../../lib/analytics';
import { sendTelegramMessage } from '../../../../lib/telegram';

export const runtime = 'nodejs';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  return querySecret === secret || bearer === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await getTrafficReportStats();
  const report = formatTrafficReport(stats);

  await sendTelegramMessage(report, { disableWebPagePreview: true });

  return NextResponse.json({ ok: true, stats });
}