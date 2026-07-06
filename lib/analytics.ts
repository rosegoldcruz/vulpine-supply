import { escapeTelegramHtml } from './telegram';

const PREFIX = 'vulpine:supply:analytics';
const EXPIRATION_SECONDS = 60 * 60 * 24 * 30;
const REPORT_HOURS = 6;

export type AnalyticsEventType = 'page_view' | 'contact_section_view' | 'request_bid_submission';

export type AnalyticsPayload = {
  path?: string;
  href?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  eventType?: AnalyticsEventType;
  deviceType?: string;
  visitorId?: string;
};

type CounterMap = Record<string, number>;

export type TrafficReportStats = {
  pageViews: number;
  uniqueVisitors: number;
  homepageViews: number;
  requestBidPageViews: number;
  contactSectionViews: number;
  requestBidSubmissions: number;
  homepageContactSubmissions: number;
  devices: CounterMap;
  referrers: CounterMap;
  utmSources: CounterMap;
  utmCampaigns: CounterMap;
  topPages: CounterMap;
};

type RedisCommand = Array<string | number>;

const memoryCounters = new Map<string, number>();
const memorySets = new Map<string, Set<string>>();

function clean(value: unknown, fallback = 'unknown'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, 500);
  return trimmed || fallback;
}

function cleanPath(value: unknown): string {
  const path = clean(value, '/');
  return path.startsWith('/') ? path : '/';
}

function hourKey(date = new Date()): string {
  const iso = date.toISOString();
  return iso.slice(0, 13);
}

function scopedKey(hour: string, suffix: string): string {
  return `${PREFIX}:${hour}:${suffix}`;
}

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  return {
    url: url.replace(/\/+$/, ''),
    token,
  };
}

async function redisPipeline(commands: RedisCommand[]) {
  const config = getRedisConfig();
  if (!config) {
    runMemoryCommands(commands);
    return [];
  }

  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Analytics storage failed: ${response.status} ${body}`);
  }

  return response.json();
}

function runMemoryCommands(commands: RedisCommand[]) {
  for (const command of commands) {
    const [name, key, value] = command;
    if (name === 'INCRBY') {
      memoryCounters.set(String(key), (memoryCounters.get(String(key)) || 0) + Number(value || 0));
    }

    if (name === 'SADD') {
      const set = memorySets.get(String(key)) || new Set<string>();
      set.add(String(value));
      memorySets.set(String(key), set);
    }
  }
}

function addCounter(commands: RedisCommand[], hour: string, suffix: string, amount = 1) {
  const key = scopedKey(hour, suffix);
  commands.push(['INCRBY', key, amount], ['EXPIRE', key, EXPIRATION_SECONDS]);
}

function addSetMember(commands: RedisCommand[], hour: string, suffix: string, member: string) {
  const key = scopedKey(hour, suffix);
  commands.push(['SADD', key, member], ['EXPIRE', key, EXPIRATION_SECONDS]);
}

export async function trackAnalyticsEvent(payload: AnalyticsPayload): Promise<void> {
  const hour = hourKey();
  const eventType = payload.eventType || 'page_view';
  const path = cleanPath(payload.path || derivePath(payload.href));
  const deviceType = clean(payload.deviceType, 'unknown').toLowerCase();
  const commands: RedisCommand[] = [];

  addCounter(commands, hour, `event:${eventType}`);

  if (eventType === 'page_view') {
    addCounter(commands, hour, 'page_views');
    addCounter(commands, hour, `path:${path}`);
    addSetMember(commands, hour, 'paths', path);
  }

  if (eventType === 'request_bid_submission') {
    addCounter(commands, hour, `lead_path:${path}`);
    addSetMember(commands, hour, 'lead_paths', path);
  }

  if (payload.visitorId) {
    addSetMember(commands, hour, 'unique_visitors', clean(payload.visitorId));
  }

  addCounter(commands, hour, `device:${deviceType}`);
  addSetMember(commands, hour, 'devices', deviceType);

  if (payload.referrer) {
    const referrer = clean(payload.referrer, 'direct');
    addCounter(commands, hour, `referrer:${referrer}`);
    addSetMember(commands, hour, 'referrers', referrer);
  }

  if (payload.utmSource) {
    const utmSource = clean(payload.utmSource);
    addCounter(commands, hour, `utm_source:${utmSource}`);
    addSetMember(commands, hour, 'utm_sources', utmSource);
  }

  if (payload.utmCampaign) {
    const utmCampaign = clean(payload.utmCampaign);
    addCounter(commands, hour, `utm_campaign:${utmCampaign}`);
    addSetMember(commands, hour, 'utm_campaigns', utmCampaign);
  }

  await redisPipeline(commands);
}

function derivePath(href: unknown): string {
  if (typeof href !== 'string') return '/';

  try {
    const url = new URL(href);
    return url.pathname + url.hash;
  } catch {
    return '/';
  }
}

function reportHours(now = new Date()): string[] {
  const currentHour = new Date(now);
  currentHour.setUTCMinutes(0, 0, 0);

  return Array.from({ length: REPORT_HOURS }, (_, index) => {
    const date = new Date(currentHour);
    date.setUTCHours(currentHour.getUTCHours() - index);
    return hourKey(date);
  });
}

async function redisRead(commands: RedisCommand[]) {
  const config = getRedisConfig();
  if (!config) return readMemoryCommands(commands);

  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Analytics read failed: ${response.status} ${body}`);
  }

  const results = await response.json();
  return results.map((item: { result?: unknown }) => item?.result ?? 0);
}

function readMemoryCommands(commands: RedisCommand[]) {
  return commands.map(([name, key]) => {
    if (name === 'GET') return memoryCounters.get(String(key)) || 0;
    if (name === 'SCARD') return memorySets.get(String(key))?.size || 0;
    if (name === 'SMEMBERS') return Array.from(memorySets.get(String(key)) || []);
    return 0;
  });
}

function numberResult(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function addMapValue(map: CounterMap, key: string, amount: number) {
  map[key] = (map[key] || 0) + amount;
}

async function sumCounter(hours: string[], suffix: string): Promise<number> {
  const results = await redisRead(hours.map((hour) => ['GET', scopedKey(hour, suffix)]));
  return results.reduce((total, value) => total + numberResult(value), 0);
}

async function sumUniqueVisitors(hours: string[]): Promise<number> {
  const results = await redisRead(hours.map((hour) => ['SCARD', scopedKey(hour, 'unique_visitors')]));
  return results.reduce((total, value) => total + numberResult(value), 0);
}

async function sumDimension(hours: string[], setSuffix: string, counterPrefix: string): Promise<CounterMap> {
  const memberResults = await redisRead(hours.map((hour) => ['SMEMBERS', scopedKey(hour, setSuffix)]));
  const membersByHour = memberResults.map((result) => (Array.isArray(result) ? result.map(String) : []));
  const commands: RedisCommand[] = [];

  hours.forEach((hour, index) => {
    membersByHour[index].forEach((member) => commands.push(['GET', scopedKey(hour, `${counterPrefix}:${member}`)]));
  });

  if (commands.length === 0) return {};

  const counts = await redisRead(commands);
  const map: CounterMap = {};
  let countIndex = 0;

  hours.forEach((_, hourIndex) => {
    membersByHour[hourIndex].forEach((member) => {
      addMapValue(map, member, numberResult(counts[countIndex]));
      countIndex += 1;
    });
  });

  return sortMap(map);
}

function sortMap(map: CounterMap): CounterMap {
  return Object.fromEntries(Object.entries(map).sort((a, b) => b[1] - a[1]));
}

export async function getTrafficReportStats(): Promise<TrafficReportStats> {
  const hours = reportHours();
  const [
    pageViews,
    uniqueVisitors,
    homepageViews,
    requestBidPageViews,
    contactSectionViews,
    totalRequestBidSubmissions,
    leadPages,
    devices,
    referrers,
    utmSources,
    utmCampaigns,
    topPages,
  ] = await Promise.all([
    sumCounter(hours, 'page_views'),
    sumUniqueVisitors(hours),
    sumCounter(hours, 'path:/'),
    sumCounter(hours, 'path:/request-bid'),
    sumCounter(hours, 'event:contact_section_view'),
    sumCounter(hours, 'event:request_bid_submission'),
    sumDimension(hours, 'lead_paths', 'lead_path'),
    sumDimension(hours, 'devices', 'device'),
    sumDimension(hours, 'referrers', 'referrer'),
    sumDimension(hours, 'utm_sources', 'utm_source'),
    sumDimension(hours, 'utm_campaigns', 'utm_campaign'),
    sumDimension(hours, 'paths', 'path'),
  ]);

  return {
    pageViews,
    uniqueVisitors,
    homepageViews,
    requestBidPageViews,
    contactSectionViews,
    requestBidSubmissions:
      leadPages['/request-bid'] || (Object.keys(leadPages).length === 0 ? totalRequestBidSubmissions : 0),
    homepageContactSubmissions: (leadPages['/#contact'] || 0) + (leadPages['/'] || 0),
    devices,
    referrers,
    utmSources,
    utmCampaigns,
    topPages,
  };
}

function formatTopMap(map: CounterMap, emptyLabel: string): string {
  const entries = Object.entries(map).slice(0, 6);
  if (entries.length === 0) return emptyLabel;
  return entries.map(([label, count]) => `${escapeTelegramHtml(label)}: ${count}`).join('\n');
}

export function formatTrafficReport(stats: TrafficReportStats): string {
  const desktop = stats.devices.desktop || 0;
  const mobile = stats.devices.mobile || 0;
  const tablet = stats.devices.tablet || 0;
  const unknown = stats.devices.unknown || 0;
  const totalLeads = stats.requestBidSubmissions;

  return [
    `🦊 <b>VULPINE SUPPLY TRAFFIC REPORT</b>`,
    `<b>Active Site:</b> vulpinehomes.com / yournewsupplier.com`,
    `<b>Window:</b> Last 6 hours`,
    `<b>Time:</b> ${escapeTelegramHtml(new Date().toISOString())}`,
    ``,
    `📈 <b>Page Views</b>`,
    `Total: ${stats.pageViews}`,
    `Unique Visitors: ${stats.uniqueVisitors}`,
    ``,
    `🎯 <b>Key Pages</b>`,
    `Homepage: ${stats.homepageViews}`,
    `Request Bid Page: ${stats.requestBidPageViews}`,
    `Homepage Contact Section: ${stats.contactSectionViews}`,
    ``,
    `📝 <b>Leads</b>`,
    `Request Bid Submissions: ${stats.requestBidSubmissions}`,
    `Homepage Contact Submissions: ${stats.homepageContactSubmissions}`,
    `Total Leads: ${totalLeads}`,
    ``,
    `📱 <b>Devices</b>`,
    `Desktop: ${desktop}`,
    `Mobile: ${mobile}`,
    `Tablet: ${tablet}`,
    `Unknown: ${unknown}`,
    ``,
    `🔗 <b>Referrers</b>`,
    formatTopMap(stats.referrers, 'None tracked'),
    ``,
    `🏷️ <b>UTMs</b>`,
    `Source:\n${formatTopMap(stats.utmSources, 'None tracked')}`,
    `Campaign:\n${formatTopMap(stats.utmCampaigns, 'None tracked')}`,
    ``,
    `🏆 <b>Top Pages</b>`,
    formatTopMap(stats.topPages, 'None tracked'),
  ].join('\n');
}