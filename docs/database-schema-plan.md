# Database Schema Plan

Initial target: PostgreSQL with UUID primary keys, concurrency-safe business identifiers, integer minor-unit money fields, and explicit integration references.

No migrations are created in this task.

## Global Conventions

- Primary keys: `uuid`.
- Timestamps: every operational table has `created_at timestamptz not null`, `updated_at timestamptz not null`.
- Soft delete: user-facing mutable business records use `deleted_at timestamptz null`; immutable financial/version records do not use soft delete except void/cancel status fields.
- Audit: sensitive mutations create `activities` rows with actor and metadata.
- Business identifiers: separate from database PKs.
- Money: use integer minor units, e.g. cents for USD.
- Currency: every money-bearing row includes `currency_code char(3) not null default 'USD'`.

## Money Representation

Use integer minor units for persisted authoritative financial values.

Examples:

- `$1,250.75` stored as `125075`
- `dealer_cost_cents bigint`
- `sell_price_cents bigint`

Implementation consequence:

- Application services must format decimal currency for UI/PDF output.
- Calculations must use integer arithmetic and explicit rounding policy.
- Percentage values should use basis points where deterministic storage matters, e.g. `margin_bps integer`.
- Do not use JavaScript floating point as authoritative financial storage.

## Business Identifiers

Examples:

- `PRJ-2026-000042`
- `Q-2026-000421`
- `Q-2026-000421-R1`
- `PO-2026-000118`
- `SO-2026-000074`

Required table:

### `identifier_sequences`

Purpose: concurrency-safe yearly counters per entity prefix.

Columns:

- `id uuid primary key`
- `organization_id uuid not null`
- `prefix text not null`
- `year integer not null`
- `next_value integer not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:

- unique `(organization_id, prefix, year)`
- allocate identifiers inside a database transaction using row lock or atomic upsert
- never use `COUNT(*) + 1`

## Integration Reference Design

### `integration_links`

Purpose: map Vulpine records to external systems without duplicating external ownership.

Columns:

- `id uuid primary key`
- `organization_id uuid not null`
- `provider text not null` such as `ghl`, `n8n`, `hermes`, `hetzner`
- `external_object_type text not null`
- `external_object_id text not null`
- `local_entity_type text not null`
- `local_entity_id uuid not null`
- `metadata jsonb not null default '{}'::jsonb`
- `last_synced_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:

- unique `(provider, external_object_type, external_object_id)`
- index `(local_entity_type, local_entity_id)`
- index `(organization_id, provider)`

### `integration_events`

Purpose: durable inbound integration-event ledger for webhook idempotency, retry safety, failure history, and traceability.

Primary uses:

- prevent duplicate processing of GHL webhooks
- prevent duplicate project creation
- support webhook retries safely
- retain integration failure history
- provide traceability for external events

Columns:

- `id uuid primary key`
- `provider text not null`
- `external_event_id text not null`
- `event_type text not null`
- `payload jsonb not null`
- `status text not null`
- `attempt_count integer not null default 0`
- `processed_at timestamptz null`
- `last_error text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Controlled states:

- `received`
- `processing`
- `processed`
- `failed`
- `ignored`

Rules:

- unique `(provider, external_event_id)`
- index `provider`, `event_type`, `status`, `created_at`
- webhook handlers must insert or find the inbound event before applying mutations
- duplicate deliveries return success when the prior event is already `processed` or `ignored`
- project creation from GHL must be idempotent by `integration_events` plus the unique GHL opportunity reference

### `outbox_events`

Purpose: transactional outbound event queue for reliable integration delivery after authoritative Vulpine mutations.

Columns:

- `id uuid primary key`
- `event_type text not null`
- `entity_type text not null`
- `entity_id uuid not null`
- `payload jsonb not null`
- `status text not null`
- `attempt_count integer not null default 0`
- `available_at timestamptz not null`
- `processed_at timestamptz null`
- `last_error text null`
- `created_at timestamptz not null`

Controlled states:

- `pending`
- `processing`
- `processed`
- `failed`
- `ignored`

Rules:

- index `status`, `available_at`
- index `entity_type`, `entity_id`
- business mutation, authoritative database record, and corresponding outbox event must commit in the same database transaction
- workers/orchestrators process pending events and record success/failure state
- critical outbound integrations must not depend on changing the database and then assuming a following external HTTP call succeeds without durable retry state

## Entity Plan

### `organizations`

Purpose: companies, customers, suppliers, consultants' firms, and Vulpine operating entity.

Important columns:

- `id uuid primary key`
- `business_id text not null`
- `name text not null`
- `type text not null`
- `status text not null`
- `website text null`
- `phone text null`
- `email text null`
- `billing_address jsonb null`
- `shipping_address jsonb null`
- `ghl_company_id text null`
- timestamps, `deleted_at`

Rules:

- unique `business_id`
- index `type`, `status`, `ghl_company_id`

### `people`

Purpose: normalized humans across customers, contacts, staff, consultants, and supplier contacts.

Columns:

- `id uuid primary key`
- `organization_id uuid null references organizations(id)`
- `first_name text not null`
- `last_name text not null`
- `email text null`
- `phone text null`
- `title text null`
- `ghl_contact_id text null`
- timestamps, `deleted_at`

Rules:

- index `organization_id`, `email`, `phone`, `ghl_contact_id`

### `users`

Purpose: authenticated application users linked to ZITADEL.

Columns:

- `id uuid primary key`
- `person_id uuid null references people(id)`
- `organization_id uuid null references organizations(id)`
- `zitadel_subject_id text not null`
- `email text not null`
- `role_family text not null`
- `status text not null`
- `last_login_at timestamptz null`
- timestamps, `deleted_at`

Rules:

- unique `zitadel_subject_id`
- unique `email`
- index `role_family`, `organization_id`

### `organization_memberships`

Purpose: application-owned membership model for users who belong to or interact with one or more organizations.

Compatible with:

- customer organizations
- trade accounts
- consultants
- internal staff
- multi-company users
- future supplier access

Columns:

- `id uuid primary key`
- `organization_id uuid not null references organizations(id)`
- `user_id uuid not null references users(id)`
- `membership_type text not null`
- `status text not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Rules:

- unique `(organization_id, user_id, membership_type)`
- index `organization_id`, `user_id`, `membership_type`, `status`
- if the business later decides one active membership per user/org is required, enforce it with a partial unique index on active statuses instead of removing `membership_type`
- resource authorization must use memberships plus project/contact/consultant/supplier associations; ZITADEL login alone is not enough

### `properties`

Purpose: physical locations for projects and repeat unit-turn programs.

Columns:

- `id uuid primary key`
- `organization_id uuid null references organizations(id)`
- `name text null`
- `address_line1 text not null`
- `address_line2 text null`
- `city text not null`
- `state text not null`
- `postal_code text not null`
- `country text not null default 'US'`
- `property_type text null`
- `unit_count integer null`
- timestamps, `deleted_at`

Rules:

- index `organization_id`, `(city, state)`, `property_type`

### `projects`

Purpose: operational workspace created after qualification.

Columns:

- `id uuid primary key`
- `project_number text not null`
- `organization_id uuid null references organizations(id)`
- `property_id uuid null references properties(id)`
- `name text not null`
- `status text not null`
- `project_type text null`
- `source text null`
- `ghl_opportunity_id text null`
- `ghl_contact_id text null`
- `qualified_at timestamptz null`
- `closed_at timestamptz null`
- timestamps, `deleted_at`

Rules:

- unique `project_number`
- unique partial `ghl_opportunity_id where ghl_opportunity_id is not null`
- index `status`, `organization_id`, `property_id`

### `project_contacts`

Purpose: people and organizations related to a project.

Columns:

- `id uuid primary key`
- `project_id uuid not null references projects(id)`
- `person_id uuid null references people(id)`
- `organization_id uuid null references organizations(id)`
- `role text not null`
- `is_primary boolean not null default false`
- timestamps, `deleted_at`

Rules:

- index `project_id`, `person_id`, `organization_id`, `role`

### `collections`

Purpose: product grouping such as cabinet collections or finish families.

Columns:

- `id uuid primary key`
- `supplier_id uuid null references suppliers(id)`
- `name text not null`
- `category text not null`
- `description text null`
- `status text not null`
- timestamps, `deleted_at`

Rules:

- unique `(supplier_id, name)`
- index `category`, `status`

### `products`

Purpose: product models independent of specific sellable SKU variants.

Columns:

- `id uuid primary key`
- `collection_id uuid null references collections(id)`
- `name text not null`
- `category text not null`
- `description text null`
- `status text not null`
- `public_slug text null`
- `public_visible boolean not null default false`
- `specs jsonb not null default '{}'::jsonb`
- timestamps, `deleted_at`

Rules:

- unique partial `public_slug where public_slug is not null`
- index `collection_id`, `category`, `status`, `public_visible`

### `skus`

Purpose: sellable/configurable item variants.

Columns:

- `id uuid primary key`
- `product_id uuid not null references products(id)`
- `sku_code text not null`
- `name text not null`
- `finish text null`
- `configuration jsonb not null default '{}'::jsonb`
- `unit_of_measure text not null`
- `status text not null`
- timestamps, `deleted_at`

Rules:

- unique `sku_code`
- index `product_id`, `finish`, `status`

### `suppliers`

Purpose: supplier businesses and operating rules.

Columns:

- `id uuid primary key`
- `organization_id uuid null references organizations(id)`
- `supplier_code text not null`
- `name text not null`
- `status text not null`
- `territories jsonb not null default '[]'::jsonb`
- `freight_rules jsonb not null default '{}'::jsonb`
- `lead_time_days_min integer null`
- `lead_time_days_max integer null`
- `score numeric(5,2) null`
- timestamps, `deleted_at`

Rules:

- unique `supplier_code`
- index `status`, `name`

### `supplier_contacts`

Purpose: contact people for suppliers.

Columns:

- `id uuid primary key`
- `supplier_id uuid not null references suppliers(id)`
- `person_id uuid not null references people(id)`
- `role text null`
- `is_primary boolean not null default false`
- timestamps, `deleted_at`

Rules:

- unique `(supplier_id, person_id, role)`
- index `supplier_id`, `person_id`

### `price_books`

Purpose: supplier price book metadata and effective windows.

Columns:

- `id uuid primary key`
- `supplier_id uuid not null references suppliers(id)`
- `name text not null`
- `version_label text not null`
- `effective_from date not null`
- `effective_to date null`
- `currency_code char(3) not null default 'USD'`
- `file_id uuid null references files(id)`
- `status text not null`
- timestamps, `deleted_at`

Rules:

- unique `(supplier_id, name, version_label)`
- index `supplier_id`, `status`, `effective_from`

### `supplier_pricing`

Purpose: authoritative dealer cost and availability by supplier/SKU/price book.

Columns:

- `id uuid primary key`
- `supplier_id uuid not null references suppliers(id)`
- `sku_id uuid not null references skus(id)`
- `price_book_id uuid null references price_books(id)`
- `dealer_cost_cents bigint not null`
- `currency_code char(3) not null default 'USD'`
- `minimum_order_quantity integer null`
- `lead_time_days integer null`
- `warehouse text null`
- `availability_status text null`
- `effective_from date not null`
- `effective_to date null`
- timestamps, `deleted_at`

Rules:

- index `supplier_id`, `sku_id`, `price_book_id`, `effective_from`
- no customer/consultant access

### `takeoffs`

Purpose: project measurement and scope summary.

Columns:

- `id uuid primary key`
- `project_id uuid not null references projects(id)`
- `takeoff_number text not null`
- `status text not null`
- `source_file_id uuid null references files(id)`
- `created_by_user_id uuid null references users(id)`
- timestamps, `deleted_at`

Rules:

- unique `takeoff_number`
- index `project_id`, `status`

### `takeoff_items`

Purpose: scoped measured items used for pricing and quoting.

Columns:

- `id uuid primary key`
- `takeoff_id uuid not null references takeoffs(id)`
- `sku_id uuid null references skus(id)`
- `description text not null`
- `quantity numeric(12,3) not null`
- `unit_of_measure text not null`
- `notes text null`
- timestamps, `deleted_at`

Rules:

- index `takeoff_id`, `sku_id`

### `quotes`

Purpose: stable quote container with project-level identity.

Columns:

- `id uuid primary key`
- `project_id uuid not null references projects(id)`
- `quote_number text not null`
- `status text not null`
- `current_version_id uuid null`
- timestamps, `deleted_at`

Rules:

- unique `quote_number`
- index `project_id`, `status`

### `quote_versions`

Purpose: immutable submitted quote revisions.

Columns:

- `id uuid primary key`
- `quote_id uuid not null references quotes(id)`
- `revision_number integer not null`
- `revision_code text not null`
- `status text not null`
- `currency_code char(3) not null default 'USD'`
- `materials_cost_cents bigint not null default 0`
- `freight_cost_cents bigint not null default 0`
- `tax_cost_cents bigint not null default 0`
- `misc_cost_cents bigint not null default 0`
- `installation_cost_cents bigint not null default 0`
- `total_direct_cost_cents bigint not null default 0`
- `sell_price_cents bigint not null default 0`
- `contribution_profit_cents bigint not null default 0`
- `margin_bps integer null`
- `markup_bps integer null`
- `consultant_commission_cents bigint not null default 0`
- `company_net_cents bigint not null default 0`
- `customer_terms text null`
- `internal_terms text null`
- `expiration_date date null`
- `lead_time_text text null`
- `exclusions text null`
- `submitted_at timestamptz null`
- `accepted_at timestamptz null`
- timestamps

Rules:

- unique `(quote_id, revision_number)`
- unique `revision_code`
- index `quote_id`, `status`
- submitted revisions are never overwritten; corrections require a new revision
- `accepted_at` may be retained as quote-version state for quick reads, but acceptance evidence belongs in `proposal_acceptances`

### `quote_items`

Purpose: immutable line items for a quote version.

Columns:

- `id uuid primary key`
- `quote_version_id uuid not null references quote_versions(id)`
- `sku_id uuid null references skus(id)`
- `supplier_id uuid null references suppliers(id)`
- `description text not null`
- `quantity numeric(12,3) not null`
- `unit_of_measure text not null`
- `unit_cost_cents bigint not null default 0`
- `unit_sell_price_cents bigint not null default 0`
- `line_cost_cents bigint not null default 0`
- `line_sell_price_cents bigint not null default 0`
- `customer_visible boolean not null default true`
- `sort_order integer not null default 0`
- timestamps

Rules:

- index `quote_version_id`, `sku_id`, `supplier_id`

### `quote_alternates`

Purpose: optional customer or internal alternates attached to a quote version.

Columns:

- `id uuid primary key`
- `quote_version_id uuid not null references quote_versions(id)`
- `name text not null`
- `description text not null`
- `delta_cost_cents bigint not null default 0`
- `delta_sell_price_cents bigint not null default 0`
- `accepted boolean not null default false`
- timestamps

Rules:

- index `quote_version_id`, `accepted`

### `quote_documents`

Purpose: explicit association between quote versions and proposal documents, addenda, drawings, terms, spec sheets, and supporting attachments.

Columns:

- `id uuid primary key`
- `quote_version_id uuid not null references quote_versions(id)`
- `file_id uuid not null references files(id)`
- `document_type text not null`
- `title text not null`
- `description text null`
- `sort_order integer not null default 0`
- `created_at timestamptz not null`

Document types:

- `proposal`
- `addendum`
- `spec_sheet`
- `drawing`
- `terms`
- `attachment`
- `supporting_document`

Rules:

- index `quote_version_id`, `document_type`, `sort_order`
- generated proposal files belong to a specific quote version
- addenda are associated with the correct immutable revision
- previous proposal documents are not overwritten when revisions are generated
- customer-facing documents are separated from internal-only documents using the `files` visibility metadata and application authorization
- internal supplier documents must not automatically become customer-visible
- permissions are enforced through the application layer

### `proposal_acceptances`

Purpose: first-class evidence record for customer acceptance of an exact immutable quote revision.

Columns:

- `id uuid primary key`
- `quote_version_id uuid not null references quote_versions(id)`
- `accepted_by_person_id uuid null references people(id)`
- `accepted_by_user_id uuid null references users(id)`
- `accepted_at timestamptz not null`
- `acceptance_method text not null`
- `ip_address inet null`
- `user_agent text null`
- `terms_snapshot jsonb not null`
- `proposal_checksum text null`
- `signature_reference text null`
- `created_at timestamptz not null`

Optionality:

- `accepted_by_user_id` is required for authenticated portal acceptance and nullable for offline/manual acceptance.
- `accepted_by_person_id` should be present when the accepting person is known, including manual/offline entry.
- `ip_address` and `user_agent` apply to online acceptance where collection is appropriate and lawful.
- `signature_reference` is nullable unless a future signature artifact exists.
- `proposal_checksum` should reference the generated proposal document checksum when available.

Rules:

- index `quote_version_id`, `accepted_at`
- acceptance must identify the exact immutable quote revision being accepted
- acceptance evidence must preserve who accepted, what revision was accepted, when it was accepted, what commercial terms were presented, which generated proposal document corresponded to acceptance, whether a signature artifact exists, and relevant request metadata where appropriate and lawful
- this schema supports future secure customer acceptance but does not imply a complete legal electronic-signature platform exists today

### `pricing_policies`

Purpose: extensible pricing and commission policy definitions.

Columns:

- `id uuid primary key`
- `organization_id uuid null references organizations(id)`
- `name text not null`
- `scope text not null`
- `supplier_id uuid null references suppliers(id)`
- `product_category text null`
- `customer_organization_id uuid null references organizations(id)`
- `consultant_id uuid null references consultants(id)`
- `market text null`
- `rules jsonb not null`
- `status text not null`
- `effective_from date not null`
- `effective_to date null`
- timestamps, `deleted_at`

Rules:

- index `scope`, `status`, `supplier_id`, `product_category`, `consultant_id`

### `sales_orders` and `sales_order_items`

Purpose: accepted quote converted to customer order.

Key columns:

- `sales_orders`: `id`, `sales_order_number`, `project_id`, `quote_version_id`, `status`, totals in cents, timestamps, `deleted_at`
- `sales_order_items`: `id`, `sales_order_id`, `quote_item_id`, `sku_id`, `description`, `quantity`, `unit_sell_price_cents`, `line_sell_price_cents`, timestamps

Rules:

- unique `sales_order_number`
- index project/status and order item order/SKU

### `purchase_orders` and `purchase_order_items`

Purpose: supplier procurement generated from sales order/project needs.

Key columns:

- `purchase_orders`: `id`, `purchase_order_number`, `project_id`, `supplier_id`, `sales_order_id`, `status`, `ordered_at`, `confirmed_at`, totals in cents, `file_id`, timestamps, `deleted_at`
- `purchase_order_items`: `id`, `purchase_order_id`, `sku_id`, `description`, `quantity`, `unit_cost_cents`, `line_cost_cents`, `supplier_confirmation_ref`, timestamps

Rules:

- unique `purchase_order_number`
- index project/supplier/status

### `shipments`

Purpose: supplier/carrier movement of goods.

Columns:

- `id uuid primary key`
- `project_id uuid not null references projects(id)`
- `purchase_order_id uuid null references purchase_orders(id)`
- `carrier_name text null`
- `tracking_number text null`
- `status text not null`
- `estimated_pickup_at timestamptz null`
- `estimated_delivery_at timestamptz null`
- `actual_delivery_at timestamptz null`
- timestamps, `deleted_at`

Rules:

- index `project_id`, `purchase_order_id`, `status`, `tracking_number`

### `deliveries`

Purpose: delivery appointment, completion, and proof of delivery.

Columns:

- `id uuid primary key`
- `shipment_id uuid null references shipments(id)`
- `project_id uuid not null references projects(id)`
- `status text not null`
- `scheduled_at timestamptz null`
- `delivered_at timestamptz null`
- `pod_file_id uuid null references files(id)`
- `notes text null`
- timestamps, `deleted_at`

Rules:

- index `project_id`, `shipment_id`, `status`

### `damage_claims`

Purpose: damage, shortage, and exception tracking.

Columns:

- `id uuid primary key`
- `project_id uuid not null references projects(id)`
- `delivery_id uuid null references deliveries(id)`
- `purchase_order_id uuid null references purchase_orders(id)`
- `status text not null`
- `severity text not null`
- `description text not null`
- `resolution text null`
- timestamps, `deleted_at`

Rules:

- index `project_id`, `delivery_id`, `status`, `severity`

### `invoices` and `payments`

Purpose: customer billing and receipts.

Key columns:

- `invoices`: `id`, `invoice_number`, `project_id`, `sales_order_id`, `status`, `currency_code`, `subtotal_cents`, `tax_cents`, `total_cents`, `due_at`, `issued_at`, `paid_at`, timestamps, `deleted_at`
- `payments`: `id`, `invoice_id`, `project_id`, `status`, `amount_cents`, `currency_code`, `method`, `external_payment_id`, `received_at`, timestamps

Rules:

- unique `invoice_number`
- unique partial `external_payment_id where external_payment_id is not null`
- index invoice/project/status

### `consultants`

Purpose: consultant profile and commission eligibility.

Columns:

- `id uuid primary key`
- `person_id uuid not null references people(id)`
- `organization_id uuid null references organizations(id)`
- `status text not null`
- `referral_code text null`
- `default_commission_policy_id uuid null references pricing_policies(id)`
- timestamps, `deleted_at`

Rules:

- unique `person_id`
- unique partial `referral_code where referral_code is not null`

### `opportunity_registrations`

Purpose: consultant-registered opportunities before or alongside GHL opportunities.

Columns:

- `id uuid primary key`
- `consultant_id uuid not null references consultants(id)`
- `organization_id uuid null references organizations(id)`
- `person_id uuid null references people(id)`
- `project_id uuid null references projects(id)`
- `status text not null`
- `ghl_opportunity_id text null`
- `submitted_at timestamptz not null`
- timestamps, `deleted_at`

Rules:

- index `consultant_id`, `status`, `ghl_opportunity_id`

### `commissions`

Purpose: calculated and payable commission records.

Columns:

- `id uuid primary key`
- `consultant_id uuid not null references consultants(id)`
- `project_id uuid not null references projects(id)`
- `quote_version_id uuid null references quote_versions(id)`
- `sales_order_id uuid null references sales_orders(id)`
- `status text not null`
- `basis_amount_cents bigint not null`
- `commission_amount_cents bigint not null`
- `currency_code char(3) not null default 'USD'`
- `policy_snapshot jsonb not null`
- `earned_at timestamptz null`
- `paid_at timestamptz null`
- timestamps

Rules:

- index `consultant_id`, `project_id`, `status`
- audit every status change

### `files`, `messages`, `tasks`, `activities`, `notifications`

Purpose:

- `files`: metadata for external storage.
- `messages`: project/portal communication records.
- `tasks`: operational work items.
- `activities`: append-only event history.
- `notifications`: user-facing alerts.

Key columns:

- `files`: see `docs/storage-plan.md`.
- `messages`: `id`, `project_id`, `sender_user_id`, `body`, `visibility_scope`, timestamps, `deleted_at`
- `tasks`: `id`, `project_id`, `assigned_to_user_id`, `title`, `status`, `priority`, `due_at`, timestamps, `deleted_at`
- `activities`: `id`, `organization_id`, `project_id`, `actor_user_id`, `actor_type`, `event_type`, `entity_type`, `entity_id`, `metadata jsonb`, `created_at`
- `notifications`: `id`, `user_id`, `project_id`, `type`, `title`, `body`, `read_at`, timestamps, `deleted_at`

Rules:

- `activities` are append-only.
- index project/user/status fields for fast dashboards.

## Quote Versioning Model

`Quote -> Quote Version -> Quote Items`

Associated evidence and documents:

- `quote_documents` attaches generated proposals, addenda, drawings, terms, spec sheets, and attachments to the exact revision.
- `proposal_acceptances` records customer acceptance evidence for the exact revision.

Rules:

- `quotes` holds stable identity like `Q-2026-000421`.
- `quote_versions` holds revisions like `Q-2026-000421-R1`.
- Draft versions may be edited.
- Submitted versions must never be overwritten.
- Submitted revision data retains line items, cost basis, sell pricing, terms, expiration, lead time, exclusions, alternates, generated proposal associations, submission state, acceptance state, acceptance evidence, and timestamps.
- Internal financial fields stay separate from customer-facing proposal output.

## Financial Model

Inputs:

- materials
- freight
- tax
- miscellaneous
- installation

Outputs:

- total direct cost
- sell price
- contribution profit
- margin percent
- markup percent
- consultant commission
- company net

Formulas:

- `total_direct_cost = materials + freight + tax + miscellaneous + installation`
- `contribution_profit = sell_price - total_direct_cost`
- `margin_bps = contribution_profit / sell_price * 10000`, guarded for zero sell price
- `markup_bps = contribution_profit / total_direct_cost * 10000`, guarded for zero cost
- `company_net = contribution_profit - consultant_commission`

Policies are extensible by:

- supplier
- product category
- project size
- customer
- consultant
- market

Do not hard-code a single commission or margin policy into the schema. Use `pricing_policies` and store policy snapshots on quote versions/commissions.

## Proposed Initial Table Count

Core plan: 44 tables.

## Proposed Migration Sequence

1. Foundation tables: `organizations`, `people`, `users`, `organization_memberships`, `identifier_sequences`.
2. Integration reliability: `integration_links`, `integration_events`, `outbox_events`.
3. Project foundation: `properties`, `projects`, `project_contacts`, `files`, `activities`, `notifications`, `messages`, `tasks`.
4. Catalog/procurement foundation: `suppliers`, `supplier_contacts`, `collections`, `products`, `skus`, `price_books`, `supplier_pricing`.
5. Estimating: `takeoffs`, `takeoff_items`.
6. Quote engine: `quotes`, `quote_versions`, `quote_items`, `quote_alternates`, `quote_documents`, `proposal_acceptances`, `pricing_policies`.
7. Orders and procurement: `sales_orders`, `sales_order_items`, `purchase_orders`, `purchase_order_items`.
8. Logistics: `shipments`, `deliveries`, `damage_claims`.
9. Finance and commissions: `invoices`, `payments`, `consultants`, `opportunity_registrations`, `commissions`.
