import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Provider errors may contain credential-bearing URLs or customer records. */
export function logFailure(label: string, error: unknown): void {
  console.error(label, { type: error instanceof Error ? error.name : 'UnknownError' });
}

export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get('authorization');
  if (!secret || !supplied?.startsWith('Bearer ')) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Bound the stream as well as Content-Length, including chunked requests. */
export async function boundedRequest(request: Request, maxBytes: number): Promise<Request> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new RequestError(413, 'Request body is too large.');
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new RequestError(413, 'Request body is too large.');
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: new Blob(chunks as BlobPart[]),
  });
}

// Both intake aliases share this distributed counter. Unknown clients share a bucket.
const RATE_SCRIPT = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
export async function enforceRateLimit(request: Request, scope: string, limit: number, seconds: number, subject?: string): Promise<void> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new RequestError(503, 'This service is temporarily unavailable.');
  // Vercel overwrites this header at ingress. nginx installs x-real-ip on the VPS.
  const raw = process.env.VERCEL
    ? request.headers.get('x-vercel-forwarded-for')
    : request.headers.get('x-real-ip');
  const candidate = raw?.split(',')[0].trim() || '';
  const ip = isIP(candidate) ? candidate : 'unknown';
  const key = `security:${scope}:${createHash('sha256').update(subject ?? ip).digest('hex')}`;
  try {
    const response = await fetch(url.replace(/\/$/, ''), {
      method: 'POST', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(['EVAL', RATE_SCRIPT, 1, key, seconds]),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Rate limit store unavailable');
    const data = await response.json();
    if (!Number.isSafeInteger(data.result) || data.result < 1 || data.error) throw new Error('Invalid rate limit response');
    if (data.result > limit) throw new RequestError(429, 'Too many requests. Please try again later.');
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(503, 'This service is temporarily unavailable.');
  }
}

/** Only configured first-party origins can receive preview cookies/bypass credentials. */
export function trustedAssetOrigin(candidate?: string): string | undefined {
  if (!candidate) return undefined;
  try {
    const origin = new URL(candidate).origin;
    const allowed = ['https://vulpinehomes.com', 'https://www.vulpinehomes.com'];
    for (const key of ['VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
      const host = process.env[key];
      if (host) allowed.push(new URL(`https://${host}`).origin);
    }
    return candidate === origin && allowed.includes(origin) ? origin : undefined;
  } catch { return undefined; }
}
