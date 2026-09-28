# Vulpine Platform Roadmap

This document defines the production blueprint for the Vulpine platform. It is documentation only. It does not create infrastructure, install packages, change routing, migrate intake, or alter authentication.

## Verified Repository State

- `/home/vulpine-supply` is the existing public Vulpine Homes Next.js 15 application.
- The app currently serves the public website at the root App Router routes.
- Current production-sensitive routes include `/`, `/supply`, `/request-bid`, `/thank-you`, `/api/contact`, `/api/request-bid`, `/api/analytics/track`, and `/api/analytics/report`.
- Current intake targets NocoDB and Telegram, with analytics tracking through Redis-compatible REST storage or in-memory fallback.
- PostgreSQL, ZITADEL, GoHighLevel, n8n, Hetzner Storage Box, and Hermes integrations are not implemented in this repo yet.
- `migration-package/vulpine-legacy-features` contains legacy visualizer, referral, Supabase, Twilio, Telegram, and Google/Replicate-related work. It should be treated as source material, not active production infrastructure.

## Domain Ownership

### `vulpinehomes.com`

Public acquisition and customer experience.

Responsibilities:

- Marketing pages
- Public product/category pages
- Project intake
- Guided project builder
- Public case studies
- Trade program pages
- Referral entry points
- Resources
- Customer-safe visualizer experiences

System of record:

- Public content is Vulpine-owned.
- Lead/contact creation is handed to GoHighLevel.
- Qualified operational records are created in Vulpine PostgreSQL only after qualification.

### `backoffice.vulpinehomes.com`

Internal operating system.

Responsibilities:

- Dashboard
- GHL-backed leads
- GHL-backed opportunities
- Projects
- Quotes
- Products
- Suppliers
- Orders
- Logistics
- Customers
- Consultants
- Documents
- Finance
- Automations
- Analytics
- Admin

System of record:

- GHL owns CRM surfaces.
- Vulpine PostgreSQL owns operational surfaces.
- Back Office may display joined operational records and GHL-backed summaries, but must not duplicate the CRM.

### `portal.vulpinehomes.com`

Customer, trade, consultant, and later supplier-facing workflows.

Responsibilities:

- Customer proposal review
- Approvals
- Customer-safe documents
- Payments and invoices
- Order and delivery status
- Consultant opportunity registration
- Consultant commission visibility
- Trade saved selections and repeat ordering
- Supplier-facing workflows later

System of record:

- Vulpine PostgreSQL owns portal-visible operational data.
- Portal users only see authorized projections of operational data.

## System Ownership Boundaries

### GoHighLevel Owns

- Sales CRM
- Contacts
- Sales leads
- Sales opportunities
- Pipeline state
- Sales assignment
- Appointments
- SMS/email nurture
- Campaign attribution
- Pre-project sales notes and follow-up

### Vulpine PostgreSQL Owns

- Projects
- Operational customer/project relationships
- Project files and metadata
- Takeoffs
- Products
- SKUs
- Collections
- Suppliers
- Supplier pricing
- Price books
- Quotes
- Quote revisions
- Quote items
- Alternates
- Sales orders
- Purchase orders
- Shipments
- Deliveries
- Damage claims
- Invoices
- Payments
- Consultant opportunity registrations
- Commissions
- Tasks
- Activities
- Operational notifications

### Integration Identifiers

Local Vulpine records may contain external identifiers directly when operationally useful, or through `integration_links` where polymorphic references are cleaner:

- `ghl_location_id`
- `ghl_contact_id`
- `ghl_company_id`
- `ghl_opportunity_id`
- `ghl_pipeline_id`

Do not duplicate GoHighLevel CRM functionality in PostgreSQL. Store durable references, operational snapshots required for audit, and conversion state only.

## Lifecycle

```text
Website Intake
-> GHL Contact
-> GHL Opportunity
-> Qualification
-> Vulpine Project
-> Plans / Files
-> Takeoff
-> Supplier Pricing
-> Quote
-> Proposal
-> Acceptance
-> Deposit
-> Sales Order
-> Purchase Order
-> Supplier
-> Production
-> Shipment
-> Delivery
-> Commission
-> Project Close
```

## Application Architecture Recommendation

Use the existing Next.js App Router repository and add host-aware application surfaces before considering multiple repos.

Recommended shape:

- Keep one repo.
- Add route groups for isolated layouts:
  - `app/(public)`
  - `app/(backoffice)`
  - `app/(portal)`
- Use middleware for host-to-route-group dispatch only when subdomain hosting is ready.
- Share internal packages/directories for:
  - design system
  - domain types
  - database access
  - auth/session helpers
  - service-layer modules
  - integration clients
- Enforce authorization in server-side route handlers, server actions, and service methods. Frontend layout separation is not authorization.

This keeps shared types and UI simple while preserving independent public, backoffice, and portal layouts. Separate deployments should be considered only if operational constraints require independent release cadence, runtime isolation, or security boundaries that middleware cannot provide.

## Premium UI Standards

Back Office must support:

- Information-dense desktop workflows
- Responsive tablet/mobile behavior
- Persistent navigation
- Command/search capability
- High-quality data tables
- Filtering
- Sorting
- Pagination
- Saved views where useful
- Status indicators
- Side panels/drawers where they improve workflow
- Activity timelines
- File previews
- Strong loading states
- Clear empty states
- Keyboard-friendly operations where appropriate
- Fast perceived navigation
- Accessibility
- No fake controls
- No dead navigation
- No placeholder metrics
- No decorative animations that slow operations

Public site and portals may use richer presentation, but usability, accessibility, and performance remain mandatory.

## ZITADEL Auth And RBAC Summary

Preferred identity provider: ZITADEL.

Role families:

- `admin`
- `sales`
- `ops`
- `estimator`
- `finance`
- `consultant`
- `customer`
- `supplier_later`

ZITADEL owns identity authentication. Vulpine owns resource-level application authorization through server-side services, database relationships, and organization memberships. Authorization must be enforced server-side. See `docs/auth-rbac-plan.md`.

## Implementation Phases

### PHASE 00: Platform Foundation

Dependencies:

- Current Next.js runtime remains intact.
- ZITADEL tenant/application details.
- PostgreSQL hosting decision.
- Hetzner Storage Box connection details.
- Deployment host/subdomain strategy.

Required tables:

- `organizations`
- `people`
- `users`
- `organization_memberships`
- `properties`
- `files`
- `activities`
- `notifications`
- `integration_links`
- `integration_events`
- `outbox_events`
- `identifier_sequences`

Routes:

- `/backoffice`
- `/backoffice/admin`
- `/portal`
- `/api/health`
- `/api/auth/*` once ZITADEL is implemented

Services:

- `db`
- `auth`
- `rbac`
- `storage`
- `activityLog`
- `identifier`
- `integrationLink`
- `integrationEvent`
- `outboxEvent`

Integrations:

- PostgreSQL
- ZITADEL
- Hetzner Storage Box metadata boundary

Permission requirements:

- Admin-only platform configuration.
- Internal-only backoffice access.
- Server-side permission checks before any sensitive data read.

File/storage requirements:

- Metadata table defined before file upload logic.
- Storage service abstraction defined before writing production file paths.

Acceptance criteria:

- App still serves existing public website unchanged.
- Back Office and Portal layouts exist behind authorization.
- Database service layer can read/write foundation tables.
- RBAC helper can answer permission questions server-side.
- Organization membership checks can support multi-company users.
- Integration event and outbox tables are part of the foundation schema plan, even though no workers are implemented in this phase.

Deployment dependencies:

- Environment variables for PostgreSQL, ZITADEL, and storage.
- Subdomain DNS and host routing decision.

### PHASE 01: GHL Integration And Website Intake

Dependencies:

- PHASE 00 service conventions.
- GHL location, pipeline, stage, custom field, and API credentials.
- Current intake behavior documented and preserved during migration.

Required tables:

- `integration_links`
- `integration_events`
- `outbox_events`
- `activities`
- `notifications`
- optional intake audit table if required by compliance

Routes:

- Existing `/api/contact`
- Existing `/api/request-bid`
- New `/api/integrations/ghl/webhook`
- New internal `/backoffice/leads`
- New internal `/backoffice/opportunities`

Services:

- `ghlClient`
- `leadIntake`
- `ghlWebhook`
- `idempotency`
- `integrationEvent`
- `outboxEvent`
- `notification`

Integrations:

- GoHighLevel
- n8n notification/orchestration event
- Existing Telegram and analytics behavior during transition

Permission requirements:

- `admin`, `sales`, and authorized `ops` can view leads/opportunities.
- Write operations to GHL require internal sales permission.

File/storage requirements:

- Intake attachments, if added later, must use storage abstraction and file metadata.

Acceptance criteria:

- Website intake can create/update GHL Contact and Opportunity.
- Returned GHL IDs are retained.
- Webhook retries do not create duplicate records.
- GHL webhook processing is idempotent through `integration_events`.
- Critical outbound GHL/n8n notifications use `outbox_events` rather than unsafe post-commit HTTP assumptions.
- Current lead capture has no outage during migration.

Deployment dependencies:

- GHL credentials and webhook signing details.
- Rollback path to existing NocoDB/Telegram behavior.

### PHASE 02: Project Workspace

Dependencies:

- Qualified GHL opportunity event contract.
- Foundation users, organizations, files, and activities.

Required tables:

- `projects`
- `project_contacts`
- `properties`
- `files`
- `messages`
- `tasks`
- `activities`
- `integration_links`

Routes:

- `/backoffice/projects`
- `/backoffice/projects/[projectId]`
- `/backoffice/projects/[projectId]/files`
- `/backoffice/projects/[projectId]/activity`

Services:

- `projectService`
- `projectContactService`
- `fileService`
- `taskService`
- `activityService`

Integrations:

- GHL project creation trigger
- Hetzner Storage Box
- Hermes indexing event for authorized documents

Permission requirements:

- Internal users can access assigned projects.
- Customers and consultants only access project subsets through portal permissions.

File/storage requirements:

- Plans, specifications, photos, and project documents must be stored externally with PostgreSQL metadata.

Acceptance criteria:

- Qualified opportunity creates exactly one Vulpine Project.
- Project activity history is permanent and queryable.
- Project files have metadata, authorization, and revision context.

Deployment dependencies:

- Storage service and project ID generation.

### PHASE 03: Products / SKUs / Suppliers / Supplier Pricing

Dependencies:

- Foundation RBAC.
- Supplier source data and product taxonomy.

Required tables:

- `products`
- `collections`
- `skus`
- `suppliers`
- `supplier_contacts`
- `supplier_pricing`
- `price_books`
- `files`
- `activities`

Routes:

- `/backoffice/products`
- `/backoffice/products/[productId]`
- `/backoffice/suppliers`
- `/backoffice/suppliers/[supplierId]`
- future public `/products/[category]`

Services:

- `productService`
- `skuService`
- `supplierService`
- `supplierPricingService`
- `priceBookService`

Integrations:

- Storage for price books and spec assets.
- Hermes indexing for supplier/product documents.

Permission requirements:

- Internal cost access restricted to `admin`, `ops`, `estimator`, and authorized `finance`.
- Customer-safe product content can be public or portal-visible.

File/storage requirements:

- Price books, specs, and media tracked as files with document type and revision.

Acceptance criteria:

- Products and SKUs can be modeled independently from supplier price books.
- Supplier cost is never exposed through public or customer-safe APIs.

Deployment dependencies:

- Product taxonomy decision and initial supplier import format.

### PHASE 04: Quote / Bid Engine

Dependencies:

- Projects.
- Products/SKUs/supplier pricing.
- Pricing policy model.

Required tables:

- `quotes`
- `quote_versions`
- `quote_items`
- `quote_alternates`
- `quote_documents`
- `proposal_acceptances`
- `pricing_policies`
- `files`
- `activities`

Routes:

- `/backoffice/quotes`
- `/backoffice/quotes/[quoteId]`
- `/backoffice/projects/[projectId]/quotes`
- `/portal/proposals/[proposalId]`

Services:

- `quoteService`
- `quoteVersionService`
- `pricingService`
- `proposalService`
- `proposalAcceptanceService`
- `quoteDocumentService`
- `pdfGenerationService`

Integrations:

- Storage for generated proposals.
- GHL update when proposal is submitted.
- n8n follow-up workflow.

Permission requirements:

- Internal financial fields restricted to authorized internal roles.
- Portal exposes customer-facing proposal data only.

File/storage requirements:

- Generated proposal PDFs stored externally in the file store, referenced by `files`, and associated to exact quote revisions through `quote_documents`.
- Addenda, spec sheets, drawings, terms, and attachments must be associated with the correct quote revision and must not inherit customer visibility automatically.

Acceptance criteria:

- Submitted quote revisions are immutable.
- `Q-YYYY-NNNNNN-Rn` revisions retain line items, cost basis, terms, expiration, lead time, exclusions, alternates, generated proposal associations, submission state, acceptance state, acceptance evidence, and timestamps.
- Customer acceptance is recorded in `proposal_acceptances` against the exact immutable quote revision; quote-version acceptance fields may exist only as derived/read state.

Deployment dependencies:

- PDF generation choice.
- Pricing policy rules approved by business owner.

### PHASE 05: Sales Orders / Purchase Orders / Procurement

Dependencies:

- Accepted quote.
- Deposit state.
- Supplier/product data.

Required tables:

- `sales_orders`
- `sales_order_items`
- `purchase_orders`
- `purchase_order_items`
- `files`
- `tasks`
- `activities`

Routes:

- `/backoffice/orders`
- `/backoffice/orders/sales/[salesOrderId]`
- `/backoffice/orders/purchase/[purchaseOrderId]`

Services:

- `salesOrderService`
- `purchaseOrderService`
- `procurementService`

Integrations:

- Storage for PO documents.
- n8n supplier communication workflows.

Permission requirements:

- Ops/admin can create procurement records.
- Finance can see money fields.
- Supplier-facing access deferred.

File/storage requirements:

- POs and supplier confirmations stored as files with metadata.

Acceptance criteria:

- Accepted quote creates procurement-ready state.
- POs preserve supplier, item, price, confirmation, and status history.

Deployment dependencies:

- Supplier communication policy.

### PHASE 06: Logistics

Dependencies:

- Purchase orders.
- Shipment and delivery workflow definitions.

Required tables:

- `shipments`
- `deliveries`
- `damage_claims`
- `files`
- `tasks`
- `notifications`
- `activities`

Routes:

- `/backoffice/logistics`
- `/backoffice/logistics/shipments/[shipmentId]`
- `/backoffice/logistics/deliveries/[deliveryId]`

Services:

- `shipmentService`
- `deliveryService`
- `damageClaimService`
- `carrierTrackingService`

Integrations:

- Carrier links/APIs later.
- n8n exception workflows.
- Storage for PODs and damage photos.

Permission requirements:

- Ops/admin logistics access.
- Customer-safe order/delivery status exposed through portal.

File/storage requirements:

- Proof of delivery, delivery documents, project photos, and damage photos.

Acceptance criteria:

- Shipments and deliveries can be tracked separately.
- Exceptions create tasks/notifications and activity history.

Deployment dependencies:

- Carrier data model and delivery status taxonomy.

### PHASE 07: Finance / Payments / Commissions

Dependencies:

- Accepted quote.
- Sales orders.
- Consultant model.

Required tables:

- `invoices`
- `payments`
- `commissions`
- `consultants`
- `activities`
- `files`

Routes:

- `/backoffice/finance`
- `/backoffice/finance/invoices`
- `/backoffice/finance/payments`
- `/backoffice/finance/commissions`
- `/portal/billing`

Services:

- `invoiceService`
- `paymentService`
- `commissionService`
- `financialCalculationService`

Integrations:

- Payment processor later.
- GHL won/lost update.
- n8n finance notifications.

Permission requirements:

- `finance` and `admin` have full finance access.
- Consultants see only their commission data.
- Customers see only customer-safe invoices/payments.

File/storage requirements:

- Invoices, receipts, and payment documents stored externally.

Acceptance criteria:

- Financial calculations are deterministic and auditable.
- Commission policy is extensible and not hard-coded.

Deployment dependencies:

- Payment processor decision and accounting policy.

### PHASE 08: Consultant Portal

Dependencies:

- Consultant entities.
- Opportunity registration.
- Commission model.
- ZITADEL portal auth.

Required tables:

- `consultants`
- `opportunity_registrations`
- `commissions`
- `projects`
- `files`
- `messages`
- `notifications`

Routes:

- `/portal/consultant`
- `/portal/consultant/opportunities`
- `/portal/consultant/projects`
- `/portal/consultant/commissions`
- `/portal/consultant/resources`

Services:

- `consultantPortalService`
- `opportunityRegistrationService`
- `commissionReadModelService`

Integrations:

- GHL registration handoff when appropriate.
- Hermes resources search later.

Permission requirements:

- Consultant sees only assigned/registered opportunities and owned commission data.

File/storage requirements:

- Approved resources only.

Acceptance criteria:

- Consultant cannot access internal cost, company net, unrelated opportunities, or unrelated projects.

Deployment dependencies:

- Consultant onboarding process.

### PHASE 09: Customer / Trade Portal

Dependencies:

- Project workspace.
- Quote/proposal model.
- Orders/logistics/finance visibility rules.

Required tables:

- `projects`
- `project_contacts`
- `quotes`
- `quote_versions`
- `files`
- `invoices`
- `payments`
- `shipments`
- `deliveries`
- `messages`
- `notifications`

Routes:

- `/portal`
- `/portal/projects`
- `/portal/projects/[projectId]`
- `/portal/proposals`
- `/portal/documents`
- `/portal/orders`
- `/portal/billing`

Services:

- `customerPortalService`
- `tradePortalService`
- `proposalAcceptanceService`
- `portalDocumentService`

Integrations:

- Payment processor later.
- Storage download links.
- n8n customer notifications.

Permission requirements:

- Customer-safe access only.
- No supplier/dealer cost, margin, markup, commission, or company net.

File/storage requirements:

- Customer-approved document flag required.

Acceptance criteria:

- Portal users see only approved documents, proposal prices, selections, invoice/payment info, order status, and delivery status.

Deployment dependencies:

- Customer invite/account policy.

### PHASE 10: Public Product/Catalog Growth Layer

Dependencies:

- Product/SKU model.
- Public content approval process.

Required tables:

- `products`
- `collections`
- `skus`
- `files`
- optional public content tables later

Routes:

- `/products/cabinets`
- `/products/countertops`
- `/products/flooring`
- `/products/vanities`
- `/products/interior-doors`
- `/products/hardware`
- `/projects`
- `/resources`
- `/trade-program`
- `/turn-program`

Services:

- `publicCatalogService`
- `caseStudyService`
- `resourceService`

Integrations:

- Storage for public product/spec assets.
- Hermes public-safe search later.

Permission requirements:

- Public access only to approved public content.

File/storage requirements:

- Public assets must be sanitized, optimized, and tracked.

Acceptance criteria:

- Product content is database-backed and does not expose internal cost.

Deployment dependencies:

- SEO and content migration plan.

### PHASE 11: Visualizer / AR / AI Functionality

Dependencies:

- Product/SKU model.
- Storage model.
- Hermes boundary.
- Customer-safe authorization.

Required tables:

- `products`
- `skus`
- `files`
- `projects`
- `activities`
- optional visualizer session tables after design

Routes:

- `/visualizer`
- `/portal/projects/[projectId]/visualizer`
- `/api/ai/project-assistant`

Services:

- `visualizerService`
- `arAssetService`
- `hermesContextService`
- `aiActionService`

Integrations:

- Hermes/Obsidian RAG
- Storage
- AI model providers later

Permission requirements:

- AI reads only authorized context.
- Any mutation initiated by an agent must call validated Vulpine server-side services.

File/storage requirements:

- Customer photos and generated assets require project/user ownership metadata.

Acceptance criteria:

- AI does not become source of truth for financial, quote, order, commission, payment, or permission state.

Deployment dependencies:

- AI provider credentials and usage controls.
