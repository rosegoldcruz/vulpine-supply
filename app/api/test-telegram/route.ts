import { NextResponse } from 'next/server';
import { sendTelegramMessage } from '../../../lib/telegram';

export const runtime = 'nodejs';

export async function GET() {
  await sendTelegramMessage(
    `✅ <b>Vulpine Telegram test passed</b>\n\nTime: ${new Date().toISOString()}`,
    { disableNotification: true }
  );

  return NextResponse.json({ ok: true });
}