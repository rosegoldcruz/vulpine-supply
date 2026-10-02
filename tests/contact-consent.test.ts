import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/contact/route';
import { SMS_CONSENT_TEXT } from '../lib/sms-consent';

test('inquiry intake accepts optional SMS consent and records only actual opt-ins', async () => {
  const originalFetch = globalThis.fetch;
  const config = {
    NOCODB_BASE_URL: 'https://intake.invalid',
    NOCODB_API_TOKEN: 'test-only',
    NOCODB_TABLE_ID: 'test-table',
    VULPINE_SUPPLY_INTAKE_TOKEN: 'test-only',
    TELEGRAM_BOT_TOKEN: 'test-only',
    TELEGRAM_CHAT_ID: 'test-only',
    KV_REST_API_URL: '', KV_REST_API_TOKEN: '',
    UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
  };
  const originalEnv = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  const stored: Record<string, unknown>[] = [];
  const messages: string[] = [];
  globalThis.fetch = (async (url, options) => {
    const target = String(url);
    const body = JSON.parse(String(options?.body));
    if (target.startsWith(config.NOCODB_BASE_URL)) {
      stored.push(body[0]);
    } else if (target.startsWith('https://api.telegram.org/')) {
      messages.push(body.text);
    } else {
      throw new Error(`Unexpected external request: ${target}`);
    }
    return Response.json({ ok: true });
  }) as typeof fetch;

  try {
    for (const consent of [undefined, false, true]) {
      const before = Date.now();
      const request = new Request('https://vulpinehomes.com/api/request-bid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Privacy requester', email: 'test@example.invalid',
          projectType: 'privacy-legal', projectDetails: 'Privacy Request: correct my email.',
          pageUrl: 'https://vulpinehomes.com/request-bid', smsConsent: consent,
          smsConsentText: 'spoofed disclosure', smsConsentTimestamp: '2000-01-01',
        }),
      });
      const response = await POST(request);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).ok, true);
      const record = stored.at(-1)!;
      assert.equal(record.smsConsent, consent === true);
      assert.equal(record.smsConsentText, consent ? SMS_CONSENT_TEXT : null);
      assert.equal(record.smsConsentSource, consent ? 'https://vulpinehomes.com/request-bid' : null);
      if (consent) {
        assert.ok(Date.parse(String(record.smsConsentTimestamp)) >= before);
      } else {
        assert.equal(record.smsConsentTimestamp, null);
      }
      assert.match(messages.at(-1)!, consent ? /SMS Consent:<\/b> Yes/ : /SMS Consent:<\/b> No/);
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
