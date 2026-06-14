# Vulpine Legacy Features Migration Package

This folder is a reference extraction from the legacy source repo **vulpinehomes.com** into the target repo **vulpine-supply**.

Scope constraints respected:
- Only files inside this package folder were added.
- No active routes in the target app were modified.
- No deployment actions performed.
- No .env files copied.
- No node_modules copied.

## Package Location
- migration-package/vulpine-legacy-features

## Copied Files
Total: **59**

- add_referral_clicks_affiliate.sql
- add_visualizer_columns.sql
- app/api/admin/referrals/job/route.ts
- app/api/admin/referrals/login/route.ts
- app/api/admin/referrals/logout/route.ts
- app/api/admin/referrals/payout/route.ts
- app/api/admin/referrals/status/route.ts
- app/api/affiliate/login/request/route.ts
- app/api/c4l-lead/route.ts
- app/api/referral/route.ts
- app/api/referrals/create-link/route.ts
- app/api/send-lead-notification/route.ts
- app/api/vulpine-kitchen-quote/route.ts
- app/api/vulpine-visualizer/route.ts
- app/cabinet-refacing-anthem/page.tsx
- app/cabinet-refacing-buckeye/page.tsx
- app/cabinet-refacing-chandler/page.tsx
- app/cabinet-refacing-gilbert/page.tsx
- app/cabinet-refacing-glendale/page.tsx
- app/cabinet-refacing-goodyear/page.tsx
- app/cabinet-refacing-mesa/page.tsx
- app/cabinet-refacing-peoria/page.tsx
- app/cabinet-refacing-phoenix-az/page.tsx
- app/cabinet-refacing-scottsdale/page.tsx
- app/cabinet-refacing-surprise/page.tsx
- app/cabinet-refacing-tempe/page.tsx
- app/components/KitchenVisualizer.tsx
- app/components/ModelViewer.tsx
- app/components/PullsSelector.tsx
- app/get-quote/page.tsx
- app/kitchen-cabinet-refacing/page.tsx
- app/lib/visualizerStore.ts
- app/r/[code]/route.ts
- app/refer/page.tsx
- app/referral/route.ts
- app/refer/ReferralLinkGenerator.tsx
- app/visualizer/CabinetVisionPage.tsx
- app/visualizer/page.tsx
- app/vulpine/kitchen-quote/page.tsx
- app/vulpine/kitchen-quote/Testimonials.tsx
- create_referral_program_v1.sql
- create_visualizer_buckets.sql
- create_visualizer_v2.sql
- fix_visualizer_schema.sql
- fix_visualizer_session_schema.sql
- lib/adminReferralsAuth.ts
- lib/affiliatePortal.ts
- lib/phoneNormalizer.ts
- lib/referralProgram.ts
- lib/referralStatus.ts
- lib/telegram.ts
- lib/twilio.ts
- lib/visualizer/engine.ts
- lib/visualizer/geminiService.ts
- public/marketing/reface-cabs.jpg
- public/marketing/refacing.png
- scripts/smoke-referral-submit.mjs
- scripts/verify-referral-v1.mjs
- supabase-fixes.sql

## Required Dependencies
Dependencies inferred from imports in copied code:

- @google-cloud/vertexai
- @react-three/drei
- @react-three/fiber
- @supabase/supabase-js
- google-auth-library
- next
- react
- replicate
- sharp
- three
- three-stdlib
- twilio

## Environment Variables (Empty Placeholders)
```env
ADMIN_REFERRALS_PASSWORD=
FB_CONVERSIONS_API_TOKEN=
GA4_API_SECRET=
GA_API_SECRET=
GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_CLOUD_LOCATION=
GOOGLE_CLOUD_PROJECT=
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=
META_CONVERSIONS_API_TOKEN=
META_PIXEL_ID=
META_TEST_EVENT_CODE=
NEXT_PUBLIC_FB_PIXEL_ID=
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NODE_ENV=
REPLICATE_API_TOKEN=
REPLICATE_GUIDANCE=
REPLICATE_MODEL=
REPLICATE_STEPS=
SMOKE_SITE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=
TELEGRAM_API_TOKEN=
TELEGRAM_BOT_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_TO_CHAT_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_TO_PHONE_NUMBER=
VERIFY_EXPECT_SECURE_COOKIE=
VERIFY_SITE_URL=
```

## API Routes Included
- app/api/admin/referrals/job/route.ts
- app/api/admin/referrals/login/route.ts
- app/api/admin/referrals/logout/route.ts
- app/api/admin/referrals/payout/route.ts
- app/api/admin/referrals/status/route.ts
- app/api/affiliate/login/request/route.ts
- app/api/c4l-lead/route.ts
- app/api/referral/route.ts
- app/api/referrals/create-link/route.ts
- app/api/send-lead-notification/route.ts
- app/api/vulpine-kitchen-quote/route.ts
- app/api/vulpine-visualizer/route.ts
- app/r/[code]/route.ts
- app/referral/route.ts

## Public Assets Included
- public/marketing/reface-cabs.jpg
- public/marketing/refacing.png

## Unresolved Dependencies
These are unresolved internal imports in this extracted snapshot and must be mapped/implemented in target before activation:

- ../cabinet-refacing-city-data
- ../components/CTAButton
- ../components/Navigation
- ../components/schemas/ServiceSchema
- ../supabaseServer
- ./GoogleAnalytics
- ./VisualizerProvider
- @/app/cabinet-refacing-city-data
- @/app/components/GoogleAnalytics
- @/app/components/city/CityLandingPage
- @/app/components/ui/Motion
- @/app/lib/visualizerStore
- @/lib/adminReferralsAuth
- @/lib/affiliateAuth
- @/lib/phoneNormalizer
- @/lib/referralProgram
- @/lib/referralStatus
- @/lib/requestRateLimit
- @/lib/supabaseAuthClient
- @/lib/supabaseServer
- @/lib/telegram
- @/lib/utils

## Safest Migration Order
1. Create DB tables and columns first (run visualizer/referral SQL migrations in staging).
2. Port shared server utilities (supabase clients, rate limiting, auth helpers) before route handlers.
3. Integrate API routes under non-production/test paths and validate request/response contracts.
4. Port UI components and pages behind feature flags; do not replace active routes yet.
5. Wire public assets and verify static references.
6. Run smoke scripts for referral and quote flows against staging only.
7. Switch traffic/paths only after parity checks and analytics validation.

## Notes
- Detailed machine-readable metadata is in MANIFEST.json.
- This package is intended for staged migration planning and implementation, not direct runtime usage.
