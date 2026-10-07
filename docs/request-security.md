# Request security

Public contact aliases share distributed Redis limits: five valid submissions per client per ten minutes, 100 globally per ten minutes, and three per email/phone per hour. These starting limits are explicit operational policy. Adjust them only with observed legitimate traffic and provider budgets. Vercel supplies the client IP; nginx deployments must overwrite `x-real-ip` at their trusted ingress. Missing or unavailable rate storage fails closed with 503. Configure either `KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` server-side.

Analytics tracking allows 120 requests per client per minute; PDF and AR generation allow 20. Request bodies are bounded while streaming. Contact photos must match supported raster signatures. SMS fallback requires explicit consent. Provider responses and submitted records are not returned in public intake responses.

Analytics reporting and the Telegram diagnostic require an exact `Authorization: Bearer` value matching a nonempty server-side `CRON_SECRET`. Query-string credentials are rejected. Diagnostic execution can send a real message; authorization tests should use mocks or invalid credentials.

PDF assets use explicit first-party origins, reject redirects, and send preview credentials only to a trusted deployment origin. Public fallback asset requests carry no preview credentials.

Run `npm test`, `npm run typecheck`, and `npm run build`. After building, `node scripts/check-pdf-security.cjs` verifies the compiled PDF route against mocked rate storage/assets without external requests or messages. Production smoke tests should use unauthorized, malformed, or read-only requests and must avoid creating customer records or notifications.
