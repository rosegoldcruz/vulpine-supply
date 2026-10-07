import { NextResponse } from 'next/server';
import { sendTelegramMessage } from '../../../lib/telegram';
import { cronAuthorized } from '../../../lib/request-security';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  await sendTelegramMessage(
    `✅ <b>Vulpine Telegram test passed</b>\n\nTime: ${new Date().toISOString()}`,
    { disableNotification: true }
  );

  return NextResponse.json({ ok: true });
}
