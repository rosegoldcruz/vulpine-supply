// Exercise the compiled route so React PDF runs through the production bundler.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

async function main() {
  const png = readFileSync('public/android-chrome-192x192.png');
  const requests = [];
  const originalFetch = globalThis.fetch;
  const keys = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'VERCEL_AUTOMATION_BYPASS_SECRET'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = 'https://ratelimit.invalid';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'test-only';
  globalThis.fetch = async (url, options) => {
    if (String(url) === process.env.UPSTASH_REDIS_REST_URL) return Response.json({ result: 1 });
    if (String(url).startsWith('data:')) return originalFetch(url, options);
    requests.push({ url: String(url), options });
    return new Response(png, { headers: { 'content-type': 'image/png' } });
  };
  try {
    const { routeModule } = require('../.next/server/app/api/design-summary/route.js');
    const response = await routeModule.userland.GET(new Request('https://attacker.invalid/api/design-summary', {
      headers: { cookie: 'session=test-only' },
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.ok((await response.arrayBuffer()).byteLength > 0);
    assert.ok(requests.length > 0);
    for (const request of requests) {
      assert.equal(new URL(request.url).origin, 'https://www.vulpinehomes.com');
      const headers = new Headers(request.options?.headers);
      assert.equal(headers.has('cookie'), false);
      assert.equal(headers.has('x-vercel-protection-bypass'), false);
      assert.equal(request.options?.redirect, 'error');
    }
    console.log('PASS: compiled PDF route generated a PDF without sending credentials to the hostile origin.');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
main().catch(() => { console.error('FAIL: compiled PDF asset security verification'); process.exitCode = 1; });
