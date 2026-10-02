# Legal implementation review — October 1, 2026

## Attorney approval before enforcement

- Review the commercial liability cap and damage exclusions (`/terms#liability`), indemnification (`/terms#indemnification`), and commercial implied-warranty language (`/terms#warranties`). Confirm enforceability for the actual customers and states served, including consumer warranty limitations. Express warranties and non-waivable remedies are preserved.
- Confirm the contracting entity. The site publishes **Vulpine Homes**; no verified legal entity suffix, registration identity, mailing address, direct phone, or contact email was found. The copy uses that published business name without inventing an LLC or corporation.
- Review venue before adding an exclusive county or court. No established contract venue was found. The previous Maricopa County clause and mandatory thirty-day pre-suit wait were removed; Arizona governing law remains with mandatory-law exceptions.
- Arbitration and class-action waivers were not added. They are optional attorney-review decisions, not implied by this implementation.
- No new contractual lien or security interest, collection attorney-fee entitlement, interest rate, or late fee was created. Review any such provisions in project contracts before use. The previous 1.5% monthly default was removed.
- No universal freight claim deadline was created. Claims must be prompt and within the actual applicable carrier, manufacturer, or project period. Counsel and operations should confirm those periods for each shipment.
- Review applicable state privacy thresholds, analytics vendor agreements/settings, and any future advertising configuration. The code does not implement an automatic Do Not Track or Global Privacy Control response; the policy discloses this. If an applicable statute requires a signal response, implement it before covered processing. No determination that all CCPA/CPRA or other state obligations apply is claimed.

## Verified site behavior

The public brand, metadata, and schema use Vulpine Homes at vulpinehomes.com. The current site markets Arizona projects; the revised legal scope supports the user-directed national material-supply relationship without inventing shipping availability for any specific product or destination. Homepage marketing was not rewritten.

Both inquiry forms collect name, email, phone, company, project type, project location, and text details. Intake also accepts address/city/state/ZIP fields. Both flows capture UTM source/medium/campaign/content/term and page source. Server intake records submitted data, timestamps, referrer and user-agent metadata, and can include forwarded IP information in its notification.

First-party analytics sends page/contact events, paths and URLs, referrers, UTM attribution, device category, and a random visitor ID. The ID is stored under `vulpine_supply_visitor_id` in browser local storage. Redis analytics uses a rolling 30-day key expiry; the in-process fallback lasts for the process. This is not a general retention schedule.

NocoDB lead persistence, Telegram inquiry/traffic notifications, and Redis/Upstash-compatible analytics storage are conditional on configuration. Google Analytics is conditional on `NEXT_PUBLIC_GA_MEASUREMENT_ID`; the live homepage inspected did not load its script. Google Fonts requests are implemented. No advertising pixel, targeted-advertising audience, public checkout/card processor, login, upload feature, newsletter signup, call-recording flow, or IP-geolocation computation was found. Archived migration modules and database schemas are not represented as active website features.

No privacy/legal email or usable mailing address was fabricated. Requests use `/request-bid`, with the new Privacy / Legal Request option. Consent is optional and privacy requests can use the same intake path without consenting to calls/texts. The website records consent but has no carrier SMS gateway or inbound STOP/HELP automation; the published wording is mirrored, with the actual messaging channel responsible for honoring requests.

## Implementation

Terms now cover all 34 requested topics; Privacy has 18 structured sections. `lib/legal/terms.js` and `lib/legal/privacy.js` separate document content from the reusable server-rendered `LegalPageShell`. Existing `/terms` and `/privacy` routes remain; no new route was added. Last Updated uses the publication date in America/Phoenix, October 1, 2026.

The contents list is sticky, independently scrollable, collapsible, and keyboard accessible. Mobile keeps the same headings and anchors with a bounded contents area. Text uses the site’s fonts, colors, and widths; contents links were increased to 14px. Both forms link Terms and Privacy beside submission. Footer links were corrected on supply, bid, and thank-you pages (the first implementation had placed their links only in navigation). Homepage and legal footers already had both links.

One shared `lib/sms-consent.js` preserves the existing disclosure verbatim across forms, server intake, and both policies. Both form handlers transmit the actual checkbox choice. Intake accepts an omitted/false choice and records consent text, timestamp, and source only for a positive choice. It uses server wording and time rather than trusting caller-supplied consent evidence.

## Validation

`npm run lint` was attempted: the repository has no lint script or installed ESLint configuration. No lint success is claimed. `npm run typecheck` passed. `npm run build` passed and statically generated both routes; next-sitemap regenerated `public/sitemap-0.xml`. The existing workspace-root warning about multiple lockfiles remains. `npm test` passed all 14 tests. The consent regression test mocks all external fetches and verifies omitted, false, and true choices, correct persistence/notification values, and rejection of spoofed consent wording and timestamps. No test inquiries were sent to real recipients.

Browser QA used headless Chrome/CDP because the Browser plugin and project Playwright dependencies are unavailable. At 1440×1000 and 390×844, both routes had correct titles, Last Updated dates, 34/18 sections, no framework overlays, and no horizontal overflow. All 52 contents anchors were clicked and checked in each viewport (104 checks total); heading destinations remained below the fixed header and within the viewport. Contents collapse/reopen passed on both routes and sizes.

Both forms passed intercepted submissions with consent selected and unselected, correct payload evidence, legal disclosure links, the privacy/legal project option, and thank-you redirects. All six routes (`/`, `/supply`, `/request-bid`, `/thank-you`, `/terms`, `/privacy`) had both legal footer links. The browser reported no console/runtime warnings or errors. Screenshots were inspected for typography, heading wrapping, palette, contents navigation, spacing, and mobile body readability. Screenshots and temporary scripts remain outside the repository. Real NocoDB, Telegram, carrier SMS, and opt-out administration were not exercised by these mocked checks.

## Exact file inventory

Created:

- `lib/legal/terms.js`
- `lib/legal/privacy.js`
- `lib/sms-consent.js`
- `tests/contact-consent.test.ts`
- `docs/legal-implementation-review.md`

Modified:

- `app/terms/page.js`
- `app/privacy/page.js`
- `components/LegalPageShell.jsx`
- `app/globals.css`
- `components/RequestBidForm.jsx`
- `components/HomePageClient.jsx`
- `app/api/contact/route.js`
- `app/supply/page.js`
- `app/request-bid/page.js`
- `app/thank-you/page.js`
- `public/sitemap-0.xml`

## Primary references used for drafting

- [Arizona warranty exclusions, A.R.S. § 47-2316](https://www.azleg.gov/ars/47/02316.htm): express warranties and conspicuous commercial disclaimers.
- [Arizona contractual remedies, A.R.S. § 47-2719](https://www.azleg.gov/ars/47/02719.htm): essential-purpose and consumer limitations on remedy restrictions.
- [California Attorney General CCPA guidance](https://www.oag.ca.gov/privacy/ccpa): conditional statutory applicability, privacy rights, and opt-out signals.

These references informed the clauses and review flags; they do not establish attorney approval or universal compliance.
