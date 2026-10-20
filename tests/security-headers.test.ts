import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextConfig = require('../next.config.js');

test('global security headers preserve website protections and AR permissions', async () => {
  const rules = await nextConfig.headers();
  const globalRules = rules.filter((rule: { source: string }) => rule.source === '/(.*)');
  assert.ok(globalRules.length > 0, 'global security headers must apply to /(.*)');
  const headers = new Map<string, string>(
    globalRules.flatMap((rule: { headers: { key: string; value: string }[] }) =>
      rule.headers.map(({ key, value }) => [key.toLowerCase(), value] as [string, string]),
    ),
  );

  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('x-xss-protection'), '1; mode=block');
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');

  const hsts = headers.get('strict-transport-security');
  assert.ok(hsts, 'Strict-Transport-Security must be present');
  const maxAge = hsts.match(/(?:^|;)\s*max-age\s*=\s*(\d+)\s*(?=;|$)/i);
  assert.ok(maxAge, 'HSTS must specify an integer max-age');
  assert.ok(Number(maxAge[1]) >= 31536000, 'HSTS max-age must be at least one year');

  const csp = headers.get('content-security-policy');
  assert.ok(csp, 'Content-Security-Policy must be present');
  const directives = csp.split(';').map((directive) => directive.trim().split(/\s+/));
  for (const [name, expected] of [
    ['base-uri', "'self'"],
    ['object-src', "'none'"],
    ['frame-ancestors', "'none'"],
  ]) {
    const matches = directives.filter(([directive]) => directive.toLowerCase() === name);
    assert.equal(matches.length, 1, `${name} must occur exactly once`);
    assert.deepEqual(matches[0].slice(1), [expected], `${name} must retain its restriction`);
  }

  const permissions = headers.get('permissions-policy');
  assert.ok(permissions, 'Permissions-Policy must be present');
  const policies = permissions.split(',').map((policy) => policy.trim());
  for (const [name, allowed] of [
    ['microphone', ''],
    ['geolocation', ''],
    ['camera', 'self'],
    ['xr-spatial-tracking', 'self'],
  ]) {
    const matches = policies.filter((policy) =>
      new RegExp(`^${name}\\s*=`).test(policy),
    );
    assert.equal(matches.length, 1, `${name} must occur exactly once`);
    assert.match(matches[0], new RegExp(`^${name}\\s*=\\(\\s*${allowed}\\s*\\)$`));
  }
});

test('legacy configurator redirect permanently preserves the wildcard path', async () => {
  const redirects = await nextConfig.redirects();
  const matches = redirects.filter(
    (redirect: { source: string }) => redirect.source === '/configurator/:path*',
  );
  assert.equal(matches.length, 1, 'legacy configurator redirect must occur exactly once');
  assert.equal(matches[0].destination, '/visualizer/:path*');
  assert.equal(matches[0].permanent, true);
});
