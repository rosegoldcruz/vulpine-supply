import { NextResponse } from 'next/server';
import { formatTrafficReport, getTrafficReportStats } from '../../../../lib/analytics';
import { sendTelegramMessage } from '../../../../lib/telegram';
import { cronAuthorized } from '../../../../lib/request-security';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await getTrafficReportStats();
  const report = formatTrafficReport(stats);

  await sendTelegramMessage(report, { disableWebPagePreview: true });

  return NextResponse.json({ ok: true, stats });
}
