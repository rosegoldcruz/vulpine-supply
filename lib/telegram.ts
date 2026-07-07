type TelegramOptions = {
  disableNotification?: boolean;
  disableWebPagePreview?: boolean;
};

export function escapeTelegramHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendTelegramMessage(
  text: string,
  options: TelegramOptions = {}
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_notification: options.disableNotification ?? false,
      disable_web_page_preview: options.disableWebPagePreview ?? true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Telegram send failed: ${response.status} ${body}`);
  }
}

export type BidRequestPayload = {
  source?: string;
  pageUrl?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  projectType?: string;
  projectLocation?: string;
  location?: string;
  projectDetails?: string;
  details?: string;
  smsConsent?: boolean;
  userAgent?: string;
  ip?: string;
};

export function formatBidRequestTelegramMessage(payload: BidRequestPayload): string {
  const name =
    payload.name ||
    [payload.firstName, payload.lastName].filter(Boolean).join(' ') ||
    'N/A';

  const projectLocation = payload.projectLocation || payload.location || 'N/A';
  const projectDetails = payload.projectDetails || payload.details || 'N/A';

  return [
    `🚨 <b>NEW VULPINE BID REQUEST</b>`,
    ``,
    `<b>Source:</b> ${escapeTelegramHtml(payload.source || 'Unknown')}`,
    `<b>Page URL:</b> ${escapeTelegramHtml(payload.pageUrl || 'N/A')}`,
    `<b>Name:</b> ${escapeTelegramHtml(name)}`,
    `<b>Company:</b> ${escapeTelegramHtml(payload.company || 'N/A')}`,
    `<b>Email:</b> ${escapeTelegramHtml(payload.email || 'N/A')}`,
    `<b>Phone:</b> ${escapeTelegramHtml(payload.phone || 'N/A')}`,
    `<b>Project Type:</b> ${escapeTelegramHtml(payload.projectType || 'N/A')}`,
    `<b>Project Location:</b> ${escapeTelegramHtml(projectLocation)}`,
    ``,
    `<b>Project Details:</b>`,
    `${escapeTelegramHtml(projectDetails)}`,
    ``,
    `<b>SMS Consent:</b> ${payload.smsConsent ? 'Yes' : 'No'}`,
    `<b>Time:</b> ${escapeTelegramHtml(new Date().toISOString())}`,
    payload.ip ? `<b>IP:</b> ${escapeTelegramHtml(payload.ip)}` : '',
    payload.userAgent
      ? `<b>User Agent:</b> ${escapeTelegramHtml(payload.userAgent.slice(0, 180))}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}