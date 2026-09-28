create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  name text not null,
  type text not null,
  status text not null,
  website text,
  phone text,
  email text,
  billing_address jsonb,
  shipping_address jsonb,
  ghl_company_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organizations_business_id_unique unique (business_id)
);

create index organizations_type_idx on organizations (type);
create index organizations_status_idx on organizations (status);
create index organizations_ghl_company_id_idx on organizations (ghl_company_id);
create trigger organizations_set_updated_at before update on organizations for each row execute function set_updated_at();

create table people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  title text,
  ghl_contact_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index people_organization_id_idx on people (organization_id);
create index people_email_idx on people (email);
create index people_phone_idx on people (phone);
create index people_ghl_contact_id_idx on people (ghl_contact_id);
create trigger people_set_updated_at before update on people for each row execute function set_updated_at();

create table users (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references people(id),
  organization_id uuid references organizations(id),
  zitadel_subject_id text not null,
  email text not null,
  role_family text not null,
  status text not null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_zitadel_subject_id_unique unique (zitadel_subject_id),
  constraint users_email_unique unique (email)
);

create index users_role_family_idx on users (role_family);
create index users_organization_id_idx on users (organization_id);
create trigger users_set_updated_at before update on users for each row execute function set_updated_at();

create table organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  membership_type text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_org_user_type_unique unique (organization_id, user_id, membership_type)
);

create index organization_memberships_organization_id_idx on organization_memberships (organization_id);
create index organization_memberships_user_id_idx on organization_memberships (user_id);
create index organization_memberships_membership_type_idx on organization_memberships (membership_type);
create index organization_memberships_status_idx on organization_memberships (status);
create trigger organization_memberships_set_updated_at before update on organization_memberships for each row execute function set_updated_at();

create table identifier_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  prefix text not null,
  year integer not null,
  next_value integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identifier_sequences_org_prefix_year_unique unique (organization_id, prefix, year),
  constraint identifier_sequences_next_value_positive check (next_value > 0)
);

create trigger identifier_sequences_set_updated_at before update on identifier_sequences for each row execute function set_updated_at();

create table integration_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  provider text not null,
  external_object_type text not null,
  external_object_id text not null,
  local_entity_type text not null,
  local_entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_links_external_unique unique (provider, external_object_type, external_object_id)
);

create index integration_links_local_idx on integration_links (local_entity_type, local_entity_id);
create index integration_links_organization_provider_idx on integration_links (organization_id, provider);
create trigger integration_links_set_updated_at before update on integration_links for each row execute function set_updated_at();

create table integration_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null,
  attempt_count integer not null default 0,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_events_provider_external_event_unique unique (provider, external_event_id),
  constraint integration_events_status_check check (status in ('received', 'processing', 'processed', 'failed', 'ignored')),
  constraint integration_events_attempt_count_nonnegative check (attempt_count >= 0)
);

create index integration_events_provider_idx on integration_events (provider);
create index integration_events_event_type_idx on integration_events (event_type);
create index integration_events_status_created_at_idx on integration_events (status, created_at);
create trigger integration_events_set_updated_at before update on integration_events for each row execute function set_updated_at();

create table outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null,
  status text not null,
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbox_events_status_check check (status in ('pending', 'processing', 'processed', 'failed', 'ignored')),
  constraint outbox_events_attempt_count_nonnegative check (attempt_count >= 0)
);

create index outbox_events_status_available_at_idx on outbox_events (status, available_at);
create index outbox_events_entity_idx on outbox_events (entity_type, entity_id);
create trigger outbox_events_set_updated_at before update on outbox_events for each row execute function set_updated_at();

create table properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  name text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'US',
  property_type text,
  unit_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index properties_organization_id_idx on properties (organization_id);
create index properties_city_state_idx on properties (city, state);
create index properties_property_type_idx on properties (property_type);
create trigger properties_set_updated_at before update on properties for each row execute function set_updated_at();

create table projects (
  id uuid primary key default gen_random_uuid(),
  project_number text not null,
  organization_id uuid references organizations(id),
  property_id uuid references properties(id),
  name text not null,
  status text not null,
  project_type text,
  source text,
  ghl_opportunity_id text,
  ghl_contact_id text,
  qualified_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint projects_project_number_unique unique (project_number)
);

create unique index projects_ghl_opportunity_id_unique on projects (ghl_opportunity_id) where ghl_opportunity_id is not null;
create index projects_status_idx on projects (status);
create index projects_organization_id_idx on projects (organization_id);
create index projects_property_id_idx on projects (property_id);
create trigger projects_set_updated_at before update on projects for each row execute function set_updated_at();

create table project_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  person_id uuid references people(id),
  organization_id uuid references organizations(id),
  role text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index project_contacts_project_id_idx on project_contacts (project_id);
create index project_contacts_person_id_idx on project_contacts (person_id);
create index project_contacts_organization_id_idx on project_contacts (organization_id);
create index project_contacts_role_idx on project_contacts (role);
create trigger project_contacts_set_updated_at before update on project_contacts for each row execute function set_updated_at();

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  supplier_code text not null,
  name text not null,
  status text not null,
  territories jsonb not null default '[]'::jsonb,
  freight_rules jsonb not null default '{}'::jsonb,
  lead_time_days_min integer,
  lead_time_days_max integer,
  score numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint suppliers_supplier_code_unique unique (supplier_code)
);

create index suppliers_status_idx on suppliers (status);
create index suppliers_name_idx on suppliers (name);
create trigger suppliers_set_updated_at before update on suppliers for each row execute function set_updated_at();

create table supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  person_id uuid not null references people(id),
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint supplier_contacts_supplier_person_role_unique unique (supplier_id, person_id, role)
);

create index supplier_contacts_supplier_id_idx on supplier_contacts (supplier_id);
create index supplier_contacts_person_id_idx on supplier_contacts (person_id);
create trigger supplier_contacts_set_updated_at before update on supplier_contacts for each row execute function set_updated_at();

create table collections (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id),
  name text not null,
  category text not null,
  description text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint collections_supplier_name_unique unique (supplier_id, name)
);

create index collections_category_idx on collections (category);
create index collections_status_idx on collections (status);
create trigger collections_set_updated_at before update on collections for each row execute function set_updated_at();

create table products (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id),
  name text not null,
  category text not null,
  description text,
  status text not null,
  public_slug text,
  public_visible boolean not null default false,
  specs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index products_public_slug_unique on products (public_slug) where public_slug is not null;
create index products_collection_id_idx on products (collection_id);
create index products_category_idx on products (category);
create index products_status_idx on products (status);
create index products_public_visible_idx on products (public_visible);
create trigger products_set_updated_at before update on products for each row execute function set_updated_at();

create table skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  sku_code text not null,
  name text not null,
  finish text,
  configuration jsonb not null default '{}'::jsonb,
  unit_of_measure text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint skus_sku_code_unique unique (sku_code)
);

create index skus_product_id_idx on skus (product_id);
create index skus_finish_idx on skus (finish);
create index skus_status_idx on skus (status);
create trigger skus_set_updated_at before update on skus for each row execute function set_updated_at();

create table pricing_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  name text not null,
  scope text not null,
  supplier_id uuid references suppliers(id),
  product_category text,
  customer_organization_id uuid references organizations(id),
  consultant_id uuid,
  market text,
  rules jsonb not null,
  status text not null,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index pricing_policies_scope_idx on pricing_policies (scope);
create index pricing_policies_status_idx on pricing_policies (status);
create index pricing_policies_supplier_id_idx on pricing_policies (supplier_id);
create index pricing_policies_product_category_idx on pricing_policies (product_category);
create index pricing_policies_consultant_id_idx on pricing_policies (consultant_id);
create trigger pricing_policies_set_updated_at before update on pricing_policies for each row execute function set_updated_at();

create table price_books (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  name text not null,
  version_label text not null,
  effective_from date not null,
  effective_to date,
  currency_code char(3) not null default 'USD',
  file_id uuid,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint price_books_supplier_name_version_unique unique (supplier_id, name, version_label)
);

create index price_books_supplier_id_idx on price_books (supplier_id);
create index price_books_status_idx on price_books (status);
create index price_books_effective_from_idx on price_books (effective_from);
create trigger price_books_set_updated_at before update on price_books for each row execute function set_updated_at();

create table supplier_pricing (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  sku_id uuid not null references skus(id),
  price_book_id uuid references price_books(id),
  dealer_cost_cents bigint not null,
  currency_code char(3) not null default 'USD',
  minimum_order_quantity integer,
  lead_time_days integer,
  warehouse text,
  availability_status text,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index supplier_pricing_supplier_sku_price_book_effective_idx on supplier_pricing (supplier_id, sku_id, price_book_id, effective_from);
create trigger supplier_pricing_set_updated_at before update on supplier_pricing for each row execute function set_updated_at();

create table takeoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  takeoff_number text not null,
  status text not null,
  source_file_id uuid,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint takeoffs_takeoff_number_unique unique (takeoff_number)
);

create index takeoffs_project_id_idx on takeoffs (project_id);
create index takeoffs_status_idx on takeoffs (status);
create trigger takeoffs_set_updated_at before update on takeoffs for each row execute function set_updated_at();

create table takeoff_items (
  id uuid primary key default gen_random_uuid(),
  takeoff_id uuid not null references takeoffs(id),
  sku_id uuid references skus(id),
  description text not null,
  quantity numeric(12,3) not null,
  unit_of_measure text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index takeoff_items_takeoff_id_idx on takeoff_items (takeoff_id);
create index takeoff_items_sku_id_idx on takeoff_items (sku_id);
create trigger takeoff_items_set_updated_at before update on takeoff_items for each row execute function set_updated_at();

create table quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  quote_number text not null,
  status text not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint quotes_quote_number_unique unique (quote_number)
);

create index quotes_project_id_idx on quotes (project_id);
create index quotes_status_idx on quotes (status);
create trigger quotes_set_updated_at before update on quotes for each row execute function set_updated_at();

create table quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id),
  revision_number integer not null,
  revision_code text not null,
  status text not null,
  currency_code char(3) not null default 'USD',
  materials_cost_cents bigint not null default 0,
  freight_cost_cents bigint not null default 0,
  tax_cost_cents bigint not null default 0,
  misc_cost_cents bigint not null default 0,
  installation_cost_cents bigint not null default 0,
  total_direct_cost_cents bigint not null default 0,
  sell_price_cents bigint not null default 0,
  contribution_profit_cents bigint not null default 0,
  margin_bps integer,
  markup_bps integer,
  consultant_commission_cents bigint not null default 0,
  company_net_cents bigint not null default 0,
  customer_terms text,
  internal_terms text,
  expiration_date date,
  lead_time_text text,
  exclusions text,
  submitted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_versions_quote_revision_unique unique (quote_id, revision_number),
  constraint quote_versions_revision_code_unique unique (revision_code)
);

create index quote_versions_quote_id_idx on quote_versions (quote_id);
create index quote_versions_status_idx on quote_versions (status);
create trigger quote_versions_set_updated_at before update on quote_versions for each row execute function set_updated_at();

alter table quotes add constraint quotes_current_version_id_fkey foreign key (current_version_id) references quote_versions(id);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references quote_versions(id),
  sku_id uuid references skus(id),
  supplier_id uuid references suppliers(id),
  description text not null,
  quantity numeric(12,3) not null,
  unit_of_measure text not null,
  unit_cost_cents bigint not null default 0,
  unit_sell_price_cents bigint not null default 0,
  line_cost_cents bigint not null default 0,
  line_sell_price_cents bigint not null default 0,
  customer_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quote_items_quote_version_id_idx on quote_items (quote_version_id);
create index quote_items_sku_id_idx on quote_items (sku_id);
create index quote_items_supplier_id_idx on quote_items (supplier_id);
create trigger quote_items_set_updated_at before update on quote_items for each row execute function set_updated_at();

create table quote_alternates (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references quote_versions(id),
  name text not null,
  description text not null,
  delta_cost_cents bigint not null default 0,
  delta_sell_price_cents bigint not null default 0,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quote_alternates_quote_version_id_idx on quote_alternates (quote_version_id);
create index quote_alternates_accepted_idx on quote_alternates (accepted);
create trigger quote_alternates_set_updated_at before update on quote_alternates for each row execute function set_updated_at();

create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  sales_order_number text not null,
  project_id uuid not null references projects(id),
  quote_version_id uuid references quote_versions(id),
  status text not null,
  currency_code char(3) not null default 'USD',
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sales_orders_sales_order_number_unique unique (sales_order_number)
);

create index sales_orders_project_id_idx on sales_orders (project_id);
create index sales_orders_status_idx on sales_orders (status);
create trigger sales_orders_set_updated_at before update on sales_orders for each row execute function set_updated_at();

create table sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id),
  quote_item_id uuid references quote_items(id),
  sku_id uuid references skus(id),
  description text not null,
  quantity numeric(12,3) not null,
  unit_sell_price_cents bigint not null default 0,
  line_sell_price_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sales_order_items_sales_order_id_idx on sales_order_items (sales_order_id);
create index sales_order_items_sku_id_idx on sales_order_items (sku_id);
create trigger sales_order_items_set_updated_at before update on sales_order_items for each row execute function set_updated_at();

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  purchase_order_number text not null,
  project_id uuid not null references projects(id),
  supplier_id uuid not null references suppliers(id),
  sales_order_id uuid references sales_orders(id),
  status text not null,
  ordered_at timestamptz,
  confirmed_at timestamptz,
  currency_code char(3) not null default 'USD',
  subtotal_cents bigint not null default 0,
  freight_cents bigint not null default 0,
  total_cents bigint not null default 0,
  file_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint purchase_orders_purchase_order_number_unique unique (purchase_order_number)
);

create index purchase_orders_project_id_idx on purchase_orders (project_id);
create index purchase_orders_supplier_id_idx on purchase_orders (supplier_id);
create index purchase_orders_status_idx on purchase_orders (status);
create trigger purchase_orders_set_updated_at before update on purchase_orders for each row execute function set_updated_at();

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id),
  sku_id uuid references skus(id),
  description text not null,
  quantity numeric(12,3) not null,
  unit_cost_cents bigint not null default 0,
  line_cost_cents bigint not null default 0,
  supplier_confirmation_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_order_items_purchase_order_id_idx on purchase_order_items (purchase_order_id);
create index purchase_order_items_sku_id_idx on purchase_order_items (sku_id);
create trigger purchase_order_items_set_updated_at before update on purchase_order_items for each row execute function set_updated_at();

create table shipments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  purchase_order_id uuid references purchase_orders(id),
  carrier_name text,
  tracking_number text,
  status text not null,
  estimated_pickup_at timestamptz,
  estimated_delivery_at timestamptz,
  actual_delivery_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index shipments_project_id_idx on shipments (project_id);
create index shipments_purchase_order_id_idx on shipments (purchase_order_id);
create index shipments_status_idx on shipments (status);
create index shipments_tracking_number_idx on shipments (tracking_number);
create trigger shipments_set_updated_at before update on shipments for each row execute function set_updated_at();

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references shipments(id),
  project_id uuid not null references projects(id),
  status text not null,
  scheduled_at timestamptz,
  delivered_at timestamptz,
  pod_file_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index deliveries_project_id_idx on deliveries (project_id);
create index deliveries_shipment_id_idx on deliveries (shipment_id);
create index deliveries_status_idx on deliveries (status);
create trigger deliveries_set_updated_at before update on deliveries for each row execute function set_updated_at();

create table damage_claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  delivery_id uuid references deliveries(id),
  purchase_order_id uuid references purchase_orders(id),
  status text not null,
  severity text not null,
  description text not null,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index damage_claims_project_id_idx on damage_claims (project_id);
create index damage_claims_delivery_id_idx on damage_claims (delivery_id);
create index damage_claims_status_idx on damage_claims (status);
create index damage_claims_severity_idx on damage_claims (severity);
create trigger damage_claims_set_updated_at before update on damage_claims for each row execute function set_updated_at();

create table files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  project_id uuid references projects(id),
  supplier_id uuid references suppliers(id),
  product_id uuid references products(id),
  sku_id uuid references skus(id),
  quote_version_id uuid references quote_versions(id),
  purchase_order_id uuid references purchase_orders(id),
  delivery_id uuid references deliveries(id),
  damage_claim_id uuid references damage_claims(id),
  document_type text not null,
  category text not null,
  title text not null,
  description text,
  storage_provider text not null,
  storage_bucket text,
  storage_key text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum_sha256 text,
  revision_label text,
  revision_number integer,
  is_customer_visible boolean not null default false,
  is_consultant_visible boolean not null default false,
  uploaded_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index files_storage_provider_key_unique on files (storage_provider, storage_key);
create index files_organization_id_idx on files (organization_id);
create index files_project_id_idx on files (project_id);
create index files_supplier_id_idx on files (supplier_id);
create index files_quote_version_id_idx on files (quote_version_id);
create index files_document_type_idx on files (document_type);
create index files_visibility_idx on files (is_customer_visible, is_consultant_visible);
create trigger files_set_updated_at before update on files for each row execute function set_updated_at();

alter table price_books add constraint price_books_file_id_fkey foreign key (file_id) references files(id);
alter table takeoffs add constraint takeoffs_source_file_id_fkey foreign key (source_file_id) references files(id);
alter table purchase_orders add constraint purchase_orders_file_id_fkey foreign key (file_id) references files(id);
alter table deliveries add constraint deliveries_pod_file_id_fkey foreign key (pod_file_id) references files(id);

create table quote_documents (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references quote_versions(id),
  file_id uuid not null references files(id),
  document_type text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index quote_documents_quote_version_type_sort_idx on quote_documents (quote_version_id, document_type, sort_order);

create table proposal_acceptances (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references quote_versions(id),
  accepted_by_person_id uuid references people(id),
  accepted_by_user_id uuid references users(id),
  accepted_at timestamptz not null,
  acceptance_method text not null,
  ip_address inet,
  user_agent text,
  terms_snapshot jsonb not null,
  proposal_checksum text,
  signature_reference text,
  created_at timestamptz not null default now()
);

create index proposal_acceptances_quote_version_accepted_at_idx on proposal_acceptances (quote_version_id, accepted_at);

create table consultants (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id),
  organization_id uuid references organizations(id),
  status text not null,
  referral_code text,
  default_commission_policy_id uuid references pricing_policies(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint consultants_person_id_unique unique (person_id)
);

create unique index consultants_referral_code_unique on consultants (referral_code) where referral_code is not null;
create trigger consultants_set_updated_at before update on consultants for each row execute function set_updated_at();

alter table pricing_policies add constraint pricing_policies_consultant_id_fkey foreign key (consultant_id) references consultants(id);

create table opportunity_registrations (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references consultants(id),
  organization_id uuid references organizations(id),
  person_id uuid references people(id),
  project_id uuid references projects(id),
  status text not null,
  ghl_opportunity_id text,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index opportunity_registrations_consultant_id_idx on opportunity_registrations (consultant_id);
create index opportunity_registrations_status_idx on opportunity_registrations (status);
create index opportunity_registrations_ghl_opportunity_id_idx on opportunity_registrations (ghl_opportunity_id);
create trigger opportunity_registrations_set_updated_at before update on opportunity_registrations for each row execute function set_updated_at();

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  project_id uuid not null references projects(id),
  sales_order_id uuid references sales_orders(id),
  status text not null,
  currency_code char(3) not null default 'USD',
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  due_at timestamptz,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint invoices_invoice_number_unique unique (invoice_number)
);

create index invoices_project_id_idx on invoices (project_id);
create index invoices_status_idx on invoices (status);
create trigger invoices_set_updated_at before update on invoices for each row execute function set_updated_at();

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id),
  project_id uuid not null references projects(id),
  status text not null,
  amount_cents bigint not null,
  currency_code char(3) not null default 'USD',
  method text not null,
  external_payment_id text,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payments_external_payment_id_unique on payments (external_payment_id) where external_payment_id is not null;
create index payments_invoice_id_idx on payments (invoice_id);
create index payments_project_id_idx on payments (project_id);
create index payments_status_idx on payments (status);
create trigger payments_set_updated_at before update on payments for each row execute function set_updated_at();

create table commissions (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references consultants(id),
  project_id uuid not null references projects(id),
  quote_version_id uuid references quote_versions(id),
  sales_order_id uuid references sales_orders(id),
  status text not null,
  basis_amount_cents bigint not null,
  commission_amount_cents bigint not null,
  currency_code char(3) not null default 'USD',
  policy_snapshot jsonb not null,
  earned_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index commissions_consultant_id_idx on commissions (consultant_id);
create index commissions_project_id_idx on commissions (project_id);
create index commissions_status_idx on commissions (status);
create trigger commissions_set_updated_at before update on commissions for each row execute function set_updated_at();

create table messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  sender_user_id uuid references users(id),
  body text not null,
  visibility_scope text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index messages_project_id_idx on messages (project_id);
create index messages_sender_user_id_idx on messages (sender_user_id);
create trigger messages_set_updated_at before update on messages for each row execute function set_updated_at();

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  assigned_to_user_id uuid references users(id),
  title text not null,
  status text not null,
  priority text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tasks_project_id_idx on tasks (project_id);
create index tasks_assigned_to_user_id_idx on tasks (assigned_to_user_id);
create index tasks_status_idx on tasks (status);
create trigger tasks_set_updated_at before update on tasks for each row execute function set_updated_at();

create table activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  project_id uuid references projects(id),
  actor_user_id uuid references users(id),
  actor_type text not null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activities_organization_id_idx on activities (organization_id);
create index activities_project_id_idx on activities (project_id);
create index activities_actor_user_id_idx on activities (actor_user_id);
create index activities_event_type_idx on activities (event_type);
create index activities_entity_idx on activities (entity_type, entity_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  project_id uuid references projects(id),
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index notifications_user_id_idx on notifications (user_id);
create index notifications_project_id_idx on notifications (project_id);
create index notifications_read_at_idx on notifications (read_at);
create trigger notifications_set_updated_at before update on notifications for each row execute function set_updated_at();
