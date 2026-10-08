# Vulpine navigation audit

Verified against the marketing repository and rendered website on 2026-10-08. Design follows the supplied Modernform screenshots while retaining Vulpine typography, orange accents, wordmark, compact header, and video hero.

## Scope and files

- `components/SiteNav.tsx`: shared six-menu header, recursive entries, desktop panels, native modal mobile drawer, keyboard/pointer dismissal, and shared promotional panel.
- `components/SiteNav.module.css`: scoped desktop/mobile layouts, imagery, hierarchy, focus indicators, touch targets, and reduced-motion styling.
- `lib/site-navigation.ts`: typed hierarchy, route targets, descriptions, imagery, CTA content, and explicit reasons for unavailable destinations. Desktop and mobile use this same configuration.
- `app/globals.css`: shared header-height and section-scroll offsets; obsolete navigation styles removed. Existing material-card sizing retained; obsolete text-ticker styles removed.
- `components/configurator/ProductInfo.tsx`: adds only the `cabinet-faq` anchor to the existing FAQ.
- `components/configurator/CabinetConfigurator.tsx`: preserves the destination hash when the existing selection URL is synchronized, so resource links retain their anchor; realigns resource anchors after the asynchronously fetched kitchen-layout picker renders.
- `public/navigation/reserve-framed.webp` and `public/navigation/alta-euro.webp`: optimized derivatives of selected uploaded framed/frameless kitchen photos.
- `tests/site-navigation.test.ts`: verifies route/section/style contracts, asset existence, unique identifiers, and absence of fabricated links.
- `docs/navigation-audit.md`: this route and verification report.

Existing product/SKU data, pricing, quote calculations, CRM, authentication, analytics, database schema, submission logic, and other applications are unchanged. The hero video, pause control, reduced desktop scale, remain intact. The text marquee is replaced by the live material GLB showcase described below. Untracked source uploads are not bulk-published.

## Project CTA and unavailable workflows

`/submit-project` is absent from the application and returned HTTP 404 on the live site during audit. The prominent header Submit Project button, SEND US THE PLANS in Projects, Submit Your Project, and Submit a Project use the existing `/request-bid` inquiry form. This is a project inquiry, not a newly implemented plan-file upload. No new routes or submission workflows were created.

No public portfolio/case-study route exists, so that conditional item is omitted. No verified consultant/dealer portal URL, registration workflow, gated catalog/download page, or partner authentication flow exists in this marketing app. Unavailable leaf items appear as plain text with “Contact us for details,” never as placeholder links. The existing contact and inquiry destinations remain available.

Existing destinations are accounted for: What We Supply maps to Products and supply links; Property Turns maps to owner/renovation solutions; Multifamily and Contractors map to Solutions; Reface Your Cabinets remains beside the primary desktop CTA and in the mobile drawer; Request a Bid remains accessible through Request a Quote, project CTAs, and the unchanged hero.

Cabinet-style grandchildren use document navigation because the existing visualizer restores URL selections on mount. Other destinations use Next.js Link. No visualizer selection or pricing logic was rewritten.

## Active destinations and missing pages

The following is the implemented configuration. Section destinations use existing homepage material/service sections; collection styles use existing visualizer selections. Missing dedicated destinations are listed explicitly.

### Products

**Cabinetry**

| Item | Destination | Audit note |
| --- | --- | --- |
| Vulpine Reserve | No active link | Dedicated Vulpine Reserve collection page is not implemented. |
| Alta Euro | No active link | Dedicated Alta Euro collection page is not implemented. |
| Cabinet Collections | `/visualizer` | Existing destination |
| ↳ Shaker Classic | `/visualizer?style=shaker_classic` | Existing destination |
| ↳ Shaker Slide | `/visualizer?style=shaker_slide` | Existing destination |
| ↳ Fusion Classic | `/visualizer?style=fusion_shaker` | Existing destination |
| ↳ Fusion Slide | `/visualizer?style=fusion_slide` | Existing destination |
| ↳ Slab | `/visualizer?style=slab` | Existing destination |
| ↳ Cabinet Boxes | `/#material-cabinet-boxes` | Existing destination |
| ↳ Cabinet Doors & Drawer Fronts | `/#material-cabinet-doors` | Existing destination |
| Cabinet Accessories | `/#material-hardware` | Existing destination |

**Interior Finishes**

| Item | Destination | Audit note |
| --- | --- | --- |
| Countertops | `/#material-countertops` | Existing destination |
| Bathroom Vanities | `/#material-vanities` | Existing destination |
| Interior Doors | `/#material-interior-doors` | Existing destination |
| Exterior Doors | No active link | No exterior-door category page or section exists. |
| Windows | No active link | No window category page or section exists. |
| Flooring | `/#material-flooring` | Existing destination |
| Wall Panels | No active link | No wall-panel category page or section exists. |
| Trim & Molding | `/#material-trim-finish` | Existing destination |
| Sinks | `/#material-sinks` | Existing destination |

**Additional Solutions**

| Item | Destination | Audit note |
| --- | --- | --- |
| Cabinet Refacing | `/visualizer` | Explore door styles and finishes. |
| Hardware | `/#material-hardware` | Existing destination |
| Interior Finish Packages | `/supply` | Coordinate materials across your project. |
| Refacing Fronts | `/#material-refacing-fronts` | Existing destination |

Footer: View all supply capabilities → `/#supply`.

### Solutions

**Project Teams**

| Item | Destination | Audit note |
| --- | --- | --- |
| Multifamily Developments | `/#mf-split` | Repeatable cabinet and finish packages. |
| General Contractors | `/#contractors` | Material selection, bid support, and delivery coordination. |
| Developers & Builders | `/#contractors` | Coordinate the material side of your build. |

**Owners & Renovations**

| Item | Destination | Audit note |
| --- | --- | --- |
| Property Owners & Operators | `/#turns` | Consistent selections for property turns. |
| Renovation & Rehabilitation | `/#turns` | Practical upgrades and clear material sequencing. |

**Cabinet & Material Supply**

| Item | Destination | Audit note |
| --- | --- | --- |
| Residential Cabinetry | `/#material-cabinet-boxes` | Existing destination |
| Cabinet Refacing | `/visualizer` | Find the right doors, finish, and hardware. |
| Nationwide Material Supply | No active link | No dedicated nationwide service page or coverage information is implemented. |

Footer: Tell us about your project → `/request-bid`.

### Projects

**Start Your Project**

| Item | Destination | Audit note |
| --- | --- | --- |
| Submit a Project | `/request-bid` | Share your scope through our existing project inquiry form. |
| Request a Quote | `/request-bid` | Existing destination |

**Explore Your Design**

| Item | Destination | Audit note |
| --- | --- | --- |
| Cabinet Visualizer | `/visualizer` | Choose a door style, finish, and hardware. |
| Reface Your Cabinets | `/visualizer` | Existing destination |

Footer: SEND US THE PLANS → `/request-bid`.

### Resources

**Cabinet Resources**

| Item | Destination | Audit note |
| --- | --- | --- |
| Product Catalogs | No active link | No published catalog page or gated download workflow exists in this website. |
| Cabinet Specifications | No active link | No dedicated published specifications page or download workflow exists. |
| Finish & Door Styles | `/visualizer` | Existing destination |
| Hardware Options | `/visualizer#hardware` | Existing destination |
| Frequently Asked Questions | `/visualizer#cabinet-faq` | Existing destination |

**Guides & Downloads**

| Item | Destination | Audit note |
| --- | --- | --- |
| Measurement Guides | No active link | No measurement-guide page or published resource workflow exists. |
| Installation Resources | No active link | Uploaded source documents are not part of a published or gated installation-resource workflow. |
| Downloads | No active link | No downloads page or gated resource workflow exists. |

Footer: Ask our team about product documents → `/#contact`.

### Partners

**Trade Partners**

| Item | Destination | Audit note |
| --- | --- | --- |
| Become a Dealer | No active link | No dealer registration workflow exists in the marketing website. |
| Consultant Portal | No active link | No verified public consultant portal destination is configured in this website. |

**Partner Support**

| Item | Destination | Audit note |
| --- | --- | --- |
| Dealer Resources | No active link | No authenticated dealer-resource destination is configured. |
| Supplier Partnerships | `/#contact` | Discuss supply opportunities with our team. |

Footer: Contact our team → `/#contact`.

### About

**Vulpine**

| Item | Destination | Audit note |
| --- | --- | --- |
| Company Overview | `/` | Existing destination |
| Why Vulpine | `/#turns` | Existing destination |
| Our Supply Network | No active link | No public supply-network page exists. |
| Markets We Serve | `/#mf-split` | Existing destination |

**Contact & Policies**

| Item | Destination | Audit note |
| --- | --- | --- |
| Contact | `/#contact` | Existing destination |
| Policies | Expandable group | Existing destination |
| ↳ Terms | `/terms` | Existing destination |
| ↳ Privacy Policy | `/privacy` | Existing destination |

## Shared promotion

“BUILT FOR MULTIFAMILY LIVING.” / “Cabinetry and complete interior finish packages for projects of every scale.”

- Submit Your Project → `/request-bid`.
- Explore Products → `/#supply`.

## Live GLB material marquee

The user additionally requested all material GLBs in the strip below the video, with floating, breathing motion instead of category text. `components/HomePageClient.jsx` now renders `MaterialMarquee` at the former ticker location. No hero GLBs were restored.

- `lib/material-marquee.ts`: existing 15-model inventory, revised exports, 9.33-second travel loop, and viewport-safe wrap positions.
- `components/MaterialMarquee.tsx`: lazy scene loading near the viewport, pause/resume, reduced-motion preference, background/offscreen suspension, and a resource-link fallback for unavailable 3D rendering.
- `components/MaterialMarqueeScene.tsx`: one WebGL canvas, real loaded GLB geometry, normalized model sizes, bobbing, rotation, breathing scale, local environment lighting, subtle stars, and the existing local Draco decoder.
- `components/MaterialMarquee.module.css`: dark strip, orange ambient glow, faded edges, and responsive controls.
- `tests/material-marquee.test.ts`: validates actual GLB headers/mesh presence and seamless movement/wrap behavior.

All existing numbered material models are included: mat1, mat2, mat4 through mat16. mat3 does not exist. Models 2, 4, 5, 7, 9, 10, 11, 14, and 15 use the existing `materials-v2` revised exports. Other models use the existing `/GLB/matN.glb` exports. Building/floor-plan/mascot GLBs remain outside the material strip.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed, including Next.js type validation and static route generation. Existing multiple-lockfile workspace-root warning remains.
- `node_modules/.bin/tsx --test tests/site-navigation.test.ts tests/material-marquee.test.ts tests/visualizer.test.ts tests/contact-consent.test.ts tests/request-security.test.ts`: all 12 tests passed. Provider operations were mocked; no production inquiry was submitted. Database-mutating integration tests were not run for this navigation change.
- No standalone lint script or configured ESLint package is present in this repository. The build’s available validity checks ran.
- Rendered Chromium checks: six desktop menus, decoded photos, white panels inside viewport, reference-viewport product fit, hover crossing, pointer-leave delay, click toggles, outside click, Escape/focus return, ArrowDown/Left/Right/Home/End, nested collection/policy entries, link dismissal, section offsets, existing quote form, style selections, FAQ navigation, and no horizontal overflow.
- Responsive checks at 1512×696, 1440×900, 1101×740, 1100×740, 768×900, 390×844, and 320×740. Mobile/tablet drawer uses nested accordions, modal focus containment, touch targets, background scroll locking, restored scrolling/focus, close button, and Escape.
- All 28 distinct active page/query/section destinations returned HTTP 200. Static tests additionally validate that their section IDs and cabinet-style keys exist.
- GLB browser verification: all 15 material assets returned HTTP 200, one canvas rendered the live geometry, and frame comparisons confirmed movement plus pause/resume on desktop (1512×900) and touch mobile (390×844). Reduced-motion mode remained still until resumed. Marquee screenshots were inspected visually.
- Visual screenshots reviewed against the supplied references: Products, Solutions, Resources, About, and nested mobile navigation. Screenshots are QA artifacts outside the repository.
- Local development environment has a pre-existing analytics endpoint HTTP 503 due to its unavailable rate-limit store. This is outside navigation scope; analytics code was preserved. Browser page-error checks passed.

The navigation is ready for the future product information. Dedicated product pages, catalogs, partner portals, supply coverage details, and plan-upload workflows still require their own implementation or verified destination URLs before they can become active links.
