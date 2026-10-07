import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedRequest, cronAuthorized, enforceRateLimit, RequestError, trustedAssetOrigin } from '../lib/request-security';
import { POST } from '../app/api/contact/route';
import { GET as report } from '../app/api/analytics/report/route';
import { GET as telegramTest } from '../app/api/test-telegram/route';

test('notification routes require a configured bearer credential, never a URL credential', async () => {
  const original = process.env.CRON_SECRET;
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Unauthorized request reached a provider'); };
  try {
    for (const secret of [undefined, 'test-only']) {
      if (secret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = secret;
      for (const url of ['https://vulpinehomes.com/api/analytics/report', 'https://vulpinehomes.com/api/analytics/report?secret=test-only']) {
        assert.equal((await report(new Request(url))).status, 401);
        assert.equal((await telegramTest(new Request(url))).status, 401);
      }
    }
    assert.equal(cronAuthorized(new Request('https://vulpinehomes.com', { headers: { authorization: 'Bearer test-only' } })), true);
    assert.equal(cronAuthorized(new Request('https://vulpinehomes.com', { headers: { authorization: 'Bearer wrong' } })), false);
  } finally {
    globalThis.fetch = fetch;
    if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original;
  }
});

test('body bounds reject forged Content-Length and oversized streamed bodies', async () => {
  for (const headers of [{}, { 'content-length': '1' }]) {
    const request = new Request('https://vulpinehomes.com/api/contact', { method: 'POST', body: '123456', headers });
    await assert.rejects(boundedRequest(request, 5), (error: unknown) => error instanceof RequestError && error.status === 413);
  }
  const request = await boundedRequest(new Request('https://vulpinehomes.com/api/contact', { method: 'POST', body: '12345' }), 5);
  assert.equal(await request.text(), '12345');
});

test('malformed intake and forged image uploads fail before any provider action', async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Invalid input reached a provider'); };
  try {
    for (const body of ['null', '[]', '{', '{"name":{}}', JSON.stringify({ name: 'x'.repeat(2001) })]) {
      const response = await POST(new Request('https://vulpinehomes.com/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body }));
      assert.equal(response.status, 400);
    }
    for (const type of ['image/svg+xml', 'image/png']) {
      const form = new FormData();
      form.append('photos', new Blob(['<script>alert(1)</script>'], { type }), 'photo.png');
      assert.equal((await POST(new Request('https://vulpinehomes.com/api/contact', { method: 'POST', body: form }))).status, 400);
    }
  } finally { globalThis.fetch = fetch; }
});

test('rate limits are distributed and fail closed when the store is unavailable', async () => {
  const keys = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'VERCEL'];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const fetch = globalThis.fetch;
  try {
    keys.forEach((key) => delete process.env[key]);
    const request = new Request('https://vulpinehomes.com/api/contact');
    await assert.rejects(enforceRateLimit(request, 'contact', 5, 600), (error: unknown) => error instanceof RequestError && error.status === 503);
    process.env.UPSTASH_REDIS_REST_URL = 'https://ratelimit.invalid';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
    globalThis.fetch = async (_url, options) => {
      assert.equal(options?.redirect, 'error');
      const command = JSON.parse(String(options?.body));
      assert.equal(command[0], 'EVAL');
      assert.equal(command[4], 600);
      return Response.json({ result: 6 });
    };
    await assert.rejects(enforceRateLimit(request, 'contact', 5, 600), (error: unknown) => error instanceof RequestError && error.status === 429);
    globalThis.fetch = async () => Response.json({ error: 'unavailable' });
    await assert.rejects(enforceRateLimit(request, 'contact', 5, 600), (error: unknown) => error instanceof RequestError && error.status === 503);
  } finally {
    globalThis.fetch = fetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('asset credentials are restricted to exact configured deployment origins', () => {
  const original = process.env.VERCEL_URL;
  try {
    process.env.VERCEL_URL = 'supply-preview.vercel.app';
    assert.equal(trustedAssetOrigin('https://supply-preview.vercel.app'), 'https://supply-preview.vercel.app');
    assert.equal(trustedAssetOrigin('https://vulpinehomes.com'), 'https://vulpinehomes.com');
    for (const candidate of ['https://attacker.invalid', 'https://vulpinehomes.com.attacker.invalid', 'http://127.0.0.1', 'https://supply-preview.vercel.app@attacker.invalid', 'https://vulpinehomes.com/path']) {
      assert.equal(trustedAssetOrigin(candidate), undefined);
    }
  } finally {
    if (original === undefined) delete process.env.VERCEL_URL; else process.env.VERCEL_URL = original;
  }
});
