# Intake Migration Plan

This document describes the current request-bid/contact workflow and the future migration path to GoHighLevel without creating a lead-capture outage.

No runtime behavior is changed in this task.

## Current Routes And Files

Routes:

- `POST /api/contact`
- `GET /api/contact`
- `POST /api/request-bid`
- `GET /api/request-bid`
- `POST /api/analytics/track`
- `GET /api/analytics/report`

Files:

- `app/api/contact/route.js`
- `app/api/request-bid/route.js`
- `components/RequestBidForm.jsx`
- `lib/telegram.ts`
- `lib/analytics.ts`
- `app/api/analytics/track/route.ts`
- `app/api/analytics/report/route.ts`

## Current Request Flow

```text
RequestBidForm
-> POST /api/request-bid
-> delegates to /api/contact handler
-> normalize payload
-> validate required fields and SMS consent
-> attempt NocoDB record creation
-> send Telegram lead notification
-> track analytics event
-> return success
-> client redirects to /thank-you?source=request-bid
```

## Current Payload

Frontend sends:

- `name`
- `email`
- `phone`
- `company`
- `source`
- `pageUrl`
- `projectType`
- `projectLocation`
- `projectDetails`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `smsConsent`
- `smsConsentText`
- `smsConsentTimestamp`
- `smsConsentSource`

Backend normalizes to:

- `source`
- `status`
- `name`
- `email`
- `phone`
- `company`
- `project_type`
- `project_location`
- `address`
- `city`
- `state`
- `zip`
- `message`
- `page_url`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `smsConsent`
- `smsConsentText`
- `smsConsentTimestamp`
- `smsConsentSource`
- `crm_synced`
- `crm_synced_at`
- `raw_payload`

## Current Validation

Current backend validation:

- name required
- email or phone required
- email format checked when email is present
- project type required
- project details required
- SMS consent required

Current frontend validation:

- SMS consent checkbox must be checked before submit
- browser-level required fields on name, project type, and message

## Current NocoDB Behavior

`app/api/contact/route.js` requires:

- `NOCODB_BASE_URL`
- `NOCODB_API_TOKEN`
- `NOCODB_TABLE_ID`
- `VULPINE_SUPPLY_INTAKE_TOKEN` is checked as required config but not used for request authorization in current code

NocoDB call:

- `POST {NOCODB_BASE_URL}/api/v2/tables/{NOCODB_TABLE_ID}/records`
- header `xc-token: NOCODB_API_TOKEN`
- body is an array containing one record

If NocoDB config is missing or NocoDB write fails:

- error is logged
- request continues to Telegram/analytics
- user may still receive success if no later fatal error occurs

## Current Telegram Behavior

`lib/telegram.ts` uses:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Lead notification is sent after NocoDB attempt. Analytics report endpoint also sends Telegram traffic reports.

Dependency to preserve:

- internal lead visibility through Telegram during migration and rollback period

## Current Analytics Behavior

`lib/analytics.ts` uses Redis-compatible REST variables:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- fallback names `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

If Redis config is absent, analytics uses in-memory counters.

Contact intake tracks:

- `request_bid_submission`
- path derived from page URL
- UTM fields

## Migration Target

```text
Website
-> GHL Contact
-> GHL Opportunity
-> integration references
-> Vulpine Project when qualified
```

## No-Outage Migration Strategy

1. Add GHL service behind a feature flag, leaving current route behavior intact.
2. On intake, continue current validation and normalization.
3. Write to current NocoDB/Telegram path first or in parallel during shadow mode.
4. Create/update GHL Contact and Opportunity.
5. Store returned GHL IDs in the future Vulpine integration reference layer once PostgreSQL exists.
6. Keep Telegram notification active until GHL delivery is verified.
7. Add idempotency keys before enabling webhook project creation.
8. Move GHL to primary only after successful monitoring window.
9. Retain fallback path for a defined rollback period.

## Dependencies To Preserve

- SMS consent text and timestamp
- UTM attribution
- source/page URL
- Telegram alerting during cutover
- analytics event tracking
- thank-you redirect behavior
- existing `/api/contact` and `/api/request-bid` route contracts until replacement is explicitly scheduled

## Future Project Creation

Project creation must not happen on raw website submission. It happens only when GHL sends the qualified trigger.

Rules:

- create project by idempotent `ghl_opportunity_id`
- if webhook repeats, return success and do not create another project
- store link from project to GHL opportunity/contact/company
- record activity for project creation source

