import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

const jsonObject = (name: string) => jsonb(name).notNull().default(sql`'{}'::jsonb`);
const jsonArray = (name: string) => jsonb(name).notNull().default(sql`'[]'::jsonb`);
const money = (name: string) => bigint(name, { mode: 'number' }).notNull().default(0);
const requiredMoney = (name: string) => bigint(name, { mode: 'number' }).notNull();
const quantity = (name = 'quantity') => numeric(name, { precision: 12, scale: 3 }).notNull();
const currencyCode = () => text('currency_code').notNull().default('USD');

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: text('business_id').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    status: text('status').notNull(),
    website: text('website'),
    phone: text('phone'),
    email: text('email'),
    billingAddress: jsonb('billing_address'),
    shippingAddress: jsonb('shipping_address'),
    ghlCompanyId: text('ghl_company_id'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    businessIdUnique: unique('organizations_business_id_unique').on(table.businessId),
    typeIdx: index('organizations_type_idx').on(table.type),
    statusIdx: index('organizations_status_idx').on(table.status),
    ghlCompanyIdx: index('organizations_ghl_company_id_idx').on(table.ghlCompanyId),
  }),
);

export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    title: text('title'),
    ghlContactId: text('ghl_contact_id'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    organizationIdx: index('people_organization_id_idx').on(table.organizationId),
    emailIdx: index('people_email_idx').on(table.email),
    phoneIdx: index('people_phone_idx').on(table.phone),
    ghlContactIdx: index('people_ghl_contact_id_idx').on(table.ghlContactId),
  }),
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id').references(() => people.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
    zitadelSubjectId: text('zitadel_subject_id').notNull(),
    email: text('email').notNull(),
    roleFamily: text('role_family').notNull(),
    status: text('status').notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    zitadelSubjectUnique: unique('users_zitadel_subject_id_unique').on(table.zitadelSubjectId),
    emailUnique: unique('users_email_unique').on(table.email),
    roleFamilyIdx: index('users_role_family_idx').on(table.roleFamily),
    organizationIdx: index('users_organization_id_idx').on(table.organizationId),
  }),
);

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    membershipType: text('membership_type').notNull(),
    status: text('status').notNull(),
    ...timestamps,
  },
  (table) => ({
    uniqueMembership: unique('organization_memberships_org_user_type_unique').on(
      table.organizationId,
      table.userId,
      table.membershipType,
    ),
    organizationIdx: index('organization_memberships_organization_id_idx').on(table.organizationId),
    userIdx: index('organization_memberships_user_id_idx').on(table.userId),
    typeIdx: index('organization_memberships_membership_type_idx').on(table.membershipType),
    statusIdx: index('organization_memberships_status_idx').on(table.status),
  }),
);

export const identifierSequences = pgTable(
  'identifier_sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    prefix: text('prefix').notNull(),
    year: integer('year').notNull(),
    nextValue: integer('next_value').notNull(),
    ...timestamps,
  },
  (table) => ({
    sequenceUnique: unique('identifier_sequences_org_prefix_year_unique').on(
      table.organizationId,
      table.prefix,
      table.year,
    ),
  }),
);

export const integrationLinks = pgTable(
  'integration_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    provider: text('provider').notNull(),
    externalObjectType: text('external_object_type').notNull(),
    externalObjectId: text('external_object_id').notNull(),
    localEntityType: text('local_entity_type').notNull(),
    localEntityId: uuid('local_entity_id').notNull(),
    metadata: jsonObject('metadata'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    externalUnique: unique('integration_links_external_unique').on(
      table.provider,
      table.externalObjectType,
      table.externalObjectId,
    ),
    localIdx: index('integration_links_local_idx').on(table.localEntityType, table.localEntityId),
    organizationProviderIdx: index('integration_links_organization_provider_idx').on(
      table.organizationId,
      table.provider,
    ),
  }),
);

export const integrationEvents = pgTable(
  'integration_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    externalEventId: text('external_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastError: text('last_error'),
    ...timestamps,
  },
  (table) => ({
    eventUnique: unique('integration_events_provider_external_event_unique').on(
      table.provider,
      table.externalEventId,
    ),
    providerIdx: index('integration_events_provider_idx').on(table.provider),
    eventTypeIdx: index('integration_events_event_type_idx').on(table.eventType),
    statusCreatedIdx: index('integration_events_status_created_at_idx').on(
      table.status,
      table.createdAt,
    ),
  }),
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastError: text('last_error'),
    ...timestamps,
  },
  (table) => ({
    pendingIdx: index('outbox_events_status_available_at_idx').on(table.status, table.availableAt),
    entityIdx: index('outbox_events_entity_idx').on(table.entityType, table.entityId),
  }),
);

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    name: text('name'),
    addressLine1: text('address_line1').notNull(),
    addressLine2: text('address_line2'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    postalCode: text('postal_code').notNull(),
    country: text('country').notNull().default('US'),
    propertyType: text('property_type'),
    unitCount: integer('unit_count'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    organizationIdx: index('properties_organization_id_idx').on(table.organizationId),
    cityStateIdx: index('properties_city_state_idx').on(table.city, table.state),
    propertyTypeIdx: index('properties_property_type_idx').on(table.propertyType),
  }),
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectNumber: text('project_number').notNull(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    propertyId: uuid('property_id').references(() => properties.id),
    name: text('name').notNull(),
    status: text('status').notNull(),
    projectType: text('project_type'),
    source: text('source'),
    ghlOpportunityId: text('ghl_opportunity_id'),
    ghlContactId: text('ghl_contact_id'),
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    projectNumberUnique: unique('projects_project_number_unique').on(table.projectNumber),
    statusIdx: index('projects_status_idx').on(table.status),
    organizationIdx: index('projects_organization_id_idx').on(table.organizationId),
    propertyIdx: index('projects_property_id_idx').on(table.propertyId),
  }),
);

export const projectContacts = pgTable(
  'project_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    personId: uuid('person_id').references(() => people.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
    role: text('role').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    projectIdx: index('project_contacts_project_id_idx').on(table.projectId),
    personIdx: index('project_contacts_person_id_idx').on(table.personId),
    organizationIdx: index('project_contacts_organization_id_idx').on(table.organizationId),
    roleIdx: index('project_contacts_role_idx').on(table.role),
  }),
);

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    supplierCode: text('supplier_code').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    territories: jsonArray('territories'),
    freightRules: jsonObject('freight_rules'),
    leadTimeDaysMin: integer('lead_time_days_min'),
    leadTimeDaysMax: integer('lead_time_days_max'),
    score: numeric('score', { precision: 5, scale: 2 }),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    supplierCodeUnique: unique('suppliers_supplier_code_unique').on(table.supplierCode),
    statusIdx: index('suppliers_status_idx').on(table.status),
    nameIdx: index('suppliers_name_idx').on(table.name),
  }),
);

export const supplierContacts = pgTable(
  'supplier_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id),
    role: text('role'),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    supplierPersonRoleUnique: unique('supplier_contacts_supplier_person_role_unique').on(
      table.supplierId,
      table.personId,
      table.role,
    ),
    supplierIdx: index('supplier_contacts_supplier_id_idx').on(table.supplierId),
    personIdx: index('supplier_contacts_person_id_idx').on(table.personId),
  }),
);

export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    name: text('name').notNull(),
    category: text('category').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    supplierNameUnique: unique('collections_supplier_name_unique').on(table.supplierId, table.name),
    categoryIdx: index('collections_category_idx').on(table.category),
    statusIdx: index('collections_status_idx').on(table.status),
  }),
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collectionId: uuid('collection_id').references(() => collections.id),
    name: text('name').notNull(),
    category: text('category').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    publicSlug: text('public_slug'),
    publicVisible: boolean('public_visible').notNull().default(false),
    specs: jsonObject('specs'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    collectionIdx: index('products_collection_id_idx').on(table.collectionId),
    categoryIdx: index('products_category_idx').on(table.category),
    statusIdx: index('products_status_idx').on(table.status),
    publicVisibleIdx: index('products_public_visible_idx').on(table.publicVisible),
  }),
);

export const skus = pgTable(
  'skus',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    skuCode: text('sku_code').notNull(),
    name: text('name').notNull(),
    finish: text('finish'),
    configuration: jsonObject('configuration'),
    unitOfMeasure: text('unit_of_measure').notNull(),
    status: text('status').notNull(),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    skuCodeUnique: unique('skus_sku_code_unique').on(table.skuCode),
    productIdx: index('skus_product_id_idx').on(table.productId),
    finishIdx: index('skus_finish_idx').on(table.finish),
    statusIdx: index('skus_status_idx').on(table.status),
  }),
);

export const pricingPolicies = pgTable(
  'pricing_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    name: text('name').notNull(),
    scope: text('scope').notNull(),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    productCategory: text('product_category'),
    customerOrganizationId: uuid('customer_organization_id').references(() => organizations.id),
    consultantId: uuid('consultant_id'),
    market: text('market'),
    rules: jsonb('rules').notNull(),
    status: text('status').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    scopeIdx: index('pricing_policies_scope_idx').on(table.scope),
    statusIdx: index('pricing_policies_status_idx').on(table.status),
    supplierIdx: index('pricing_policies_supplier_id_idx').on(table.supplierId),
    productCategoryIdx: index('pricing_policies_product_category_idx').on(table.productCategory),
    consultantIdx: index('pricing_policies_consultant_id_idx').on(table.consultantId),
  }),
);

export const priceBooks = pgTable(
  'price_books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    name: text('name').notNull(),
    versionLabel: text('version_label').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    currencyCode: currencyCode(),
    fileId: uuid('file_id'),
    status: text('status').notNull(),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    supplierNameVersionUnique: unique('price_books_supplier_name_version_unique').on(
      table.supplierId,
      table.name,
      table.versionLabel,
    ),
    supplierIdx: index('price_books_supplier_id_idx').on(table.supplierId),
    statusIdx: index('price_books_status_idx').on(table.status),
    effectiveFromIdx: index('price_books_effective_from_idx').on(table.effectiveFrom),
  }),
);

export const supplierPricing = pgTable(
  'supplier_pricing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    skuId: uuid('sku_id')
      .notNull()
      .references(() => skus.id),
    priceBookId: uuid('price_book_id').references(() => priceBooks.id),
    dealerCostCents: requiredMoney('dealer_cost_cents'),
    currencyCode: currencyCode(),
    minimumOrderQuantity: integer('minimum_order_quantity'),
    leadTimeDays: integer('lead_time_days'),
    warehouse: text('warehouse'),
    availabilityStatus: text('availability_status'),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    supplierSkuPriceBookEffectiveIdx: index(
      'supplier_pricing_supplier_sku_price_book_effective_idx',
    ).on(table.supplierId, table.skuId, table.priceBookId, table.effectiveFrom),
  }),
);

export const takeoffs = pgTable(
  'takeoffs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    takeoffNumber: text('takeoff_number').notNull(),
    status: text('status').notNull(),
    sourceFileId: uuid('source_file_id'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    takeoffNumberUnique: unique('takeoffs_takeoff_number_unique').on(table.takeoffNumber),
    projectIdx: index('takeoffs_project_id_idx').on(table.projectId),
    statusIdx: index('takeoffs_status_idx').on(table.status),
  }),
);

export const takeoffItems = pgTable(
  'takeoff_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    takeoffId: uuid('takeoff_id')
      .notNull()
      .references(() => takeoffs.id),
    skuId: uuid('sku_id').references(() => skus.id),
    description: text('description').notNull(),
    quantity: quantity(),
    unitOfMeasure: text('unit_of_measure').notNull(),
    notes: text('notes'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    takeoffIdx: index('takeoff_items_takeoff_id_idx').on(table.takeoffId),
    skuIdx: index('takeoff_items_sku_id_idx').on(table.skuId),
  }),
);

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    quoteNumber: text('quote_number').notNull(),
    status: text('status').notNull(),
    currentVersionId: uuid('current_version_id'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    quoteNumberUnique: unique('quotes_quote_number_unique').on(table.quoteNumber),
    projectIdx: index('quotes_project_id_idx').on(table.projectId),
    statusIdx: index('quotes_status_idx').on(table.status),
  }),
);

export const quoteVersions = pgTable(
  'quote_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteId: uuid('quote_id')
      .notNull()
      .references(() => quotes.id),
    revisionNumber: integer('revision_number').notNull(),
    revisionCode: text('revision_code').notNull(),
    status: text('status').notNull(),
    currencyCode: currencyCode(),
    materialsCostCents: money('materials_cost_cents'),
    freightCostCents: money('freight_cost_cents'),
    taxCostCents: money('tax_cost_cents'),
    miscCostCents: money('misc_cost_cents'),
    installationCostCents: money('installation_cost_cents'),
    totalDirectCostCents: money('total_direct_cost_cents'),
    sellPriceCents: money('sell_price_cents'),
    contributionProfitCents: money('contribution_profit_cents'),
    marginBps: integer('margin_bps'),
    markupBps: integer('markup_bps'),
    consultantCommissionCents: money('consultant_commission_cents'),
    companyNetCents: money('company_net_cents'),
    customerTerms: text('customer_terms'),
    internalTerms: text('internal_terms'),
    expirationDate: date('expiration_date'),
    leadTimeText: text('lead_time_text'),
    exclusions: text('exclusions'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    quoteRevisionUnique: unique('quote_versions_quote_revision_unique').on(
      table.quoteId,
      table.revisionNumber,
    ),
    revisionCodeUnique: unique('quote_versions_revision_code_unique').on(table.revisionCode),
    quoteIdx: index('quote_versions_quote_id_idx').on(table.quoteId),
    statusIdx: index('quote_versions_status_idx').on(table.status),
  }),
);

export const quoteItems = pgTable(
  'quote_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteVersionId: uuid('quote_version_id')
      .notNull()
      .references(() => quoteVersions.id),
    skuId: uuid('sku_id').references(() => skus.id),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    description: text('description').notNull(),
    quantity: quantity(),
    unitOfMeasure: text('unit_of_measure').notNull(),
    unitCostCents: money('unit_cost_cents'),
    unitSellPriceCents: money('unit_sell_price_cents'),
    lineCostCents: money('line_cost_cents'),
    lineSellPriceCents: money('line_sell_price_cents'),
    customerVisible: boolean('customer_visible').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    quoteVersionIdx: index('quote_items_quote_version_id_idx').on(table.quoteVersionId),
    skuIdx: index('quote_items_sku_id_idx').on(table.skuId),
    supplierIdx: index('quote_items_supplier_id_idx').on(table.supplierId),
  }),
);

export const quoteAlternates = pgTable(
  'quote_alternates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteVersionId: uuid('quote_version_id')
      .notNull()
      .references(() => quoteVersions.id),
    name: text('name').notNull(),
    description: text('description').notNull(),
    deltaCostCents: money('delta_cost_cents'),
    deltaSellPriceCents: money('delta_sell_price_cents'),
    accepted: boolean('accepted').notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    quoteVersionIdx: index('quote_alternates_quote_version_id_idx').on(table.quoteVersionId),
    acceptedIdx: index('quote_alternates_accepted_idx').on(table.accepted),
  }),
);

export const salesOrders = pgTable(
  'sales_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesOrderNumber: text('sales_order_number').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    quoteVersionId: uuid('quote_version_id').references(() => quoteVersions.id),
    status: text('status').notNull(),
    currencyCode: currencyCode(),
    subtotalCents: money('subtotal_cents'),
    taxCents: money('tax_cents'),
    totalCents: money('total_cents'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    salesOrderNumberUnique: unique('sales_orders_sales_order_number_unique').on(
      table.salesOrderNumber,
    ),
    projectIdx: index('sales_orders_project_id_idx').on(table.projectId),
    statusIdx: index('sales_orders_status_idx').on(table.status),
  }),
);

export const salesOrderItems = pgTable(
  'sales_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesOrderId: uuid('sales_order_id')
      .notNull()
      .references(() => salesOrders.id),
    quoteItemId: uuid('quote_item_id').references(() => quoteItems.id),
    skuId: uuid('sku_id').references(() => skus.id),
    description: text('description').notNull(),
    quantity: quantity(),
    unitSellPriceCents: money('unit_sell_price_cents'),
    lineSellPriceCents: money('line_sell_price_cents'),
    ...timestamps,
  },
  (table) => ({
    salesOrderIdx: index('sales_order_items_sales_order_id_idx').on(table.salesOrderId),
    skuIdx: index('sales_order_items_sku_id_idx').on(table.skuId),
  }),
);

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseOrderNumber: text('purchase_order_number').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    salesOrderId: uuid('sales_order_id').references(() => salesOrders.id),
    status: text('status').notNull(),
    orderedAt: timestamp('ordered_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    currencyCode: currencyCode(),
    subtotalCents: money('subtotal_cents'),
    freightCents: money('freight_cents'),
    totalCents: money('total_cents'),
    fileId: uuid('file_id'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    purchaseOrderNumberUnique: unique('purchase_orders_purchase_order_number_unique').on(
      table.purchaseOrderNumber,
    ),
    projectIdx: index('purchase_orders_project_id_idx').on(table.projectId),
    supplierIdx: index('purchase_orders_supplier_id_idx').on(table.supplierId),
    statusIdx: index('purchase_orders_status_idx').on(table.status),
  }),
);

export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    skuId: uuid('sku_id').references(() => skus.id),
    description: text('description').notNull(),
    quantity: quantity(),
    unitCostCents: money('unit_cost_cents'),
    lineCostCents: money('line_cost_cents'),
    supplierConfirmationRef: text('supplier_confirmation_ref'),
    ...timestamps,
  },
  (table) => ({
    purchaseOrderIdx: index('purchase_order_items_purchase_order_id_idx').on(
      table.purchaseOrderId,
    ),
    skuIdx: index('purchase_order_items_sku_id_idx').on(table.skuId),
  }),
);

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
    carrierName: text('carrier_name'),
    trackingNumber: text('tracking_number'),
    status: text('status').notNull(),
    estimatedPickupAt: timestamp('estimated_pickup_at', { withTimezone: true }),
    estimatedDeliveryAt: timestamp('estimated_delivery_at', { withTimezone: true }),
    actualDeliveryAt: timestamp('actual_delivery_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    projectIdx: index('shipments_project_id_idx').on(table.projectId),
    purchaseOrderIdx: index('shipments_purchase_order_id_idx').on(table.purchaseOrderId),
    statusIdx: index('shipments_status_idx').on(table.status),
    trackingNumberIdx: index('shipments_tracking_number_idx').on(table.trackingNumber),
  }),
);

export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id').references(() => shipments.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    status: text('status').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    podFileId: uuid('pod_file_id'),
    notes: text('notes'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    projectIdx: index('deliveries_project_id_idx').on(table.projectId),
    shipmentIdx: index('deliveries_shipment_id_idx').on(table.shipmentId),
    statusIdx: index('deliveries_status_idx').on(table.status),
  }),
);

export const damageClaims = pgTable(
  'damage_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    deliveryId: uuid('delivery_id').references(() => deliveries.id),
    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
    status: text('status').notNull(),
    severity: text('severity').notNull(),
    description: text('description').notNull(),
    resolution: text('resolution'),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    projectIdx: index('damage_claims_project_id_idx').on(table.projectId),
    deliveryIdx: index('damage_claims_delivery_id_idx').on(table.deliveryId),
    statusIdx: index('damage_claims_status_idx').on(table.status),
    severityIdx: index('damage_claims_severity_idx').on(table.severity),
  }),
);

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    projectId: uuid('project_id').references(() => projects.id),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    productId: uuid('product_id').references(() => products.id),
    skuId: uuid('sku_id').references(() => skus.id),
    quoteVersionId: uuid('quote_version_id').references(() => quoteVersions.id),
    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
    deliveryId: uuid('delivery_id').references(() => deliveries.id),
    damageClaimId: uuid('damage_claim_id').references(() => damageClaims.id),
    documentType: text('document_type').notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    storageProvider: text('storage_provider').notNull(),
    storageBucket: text('storage_bucket'),
    storageKey: text('storage_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: requiredMoney('size_bytes'),
    checksumSha256: text('checksum_sha256'),
    revisionLabel: text('revision_label'),
    revisionNumber: integer('revision_number'),
    isCustomerVisible: boolean('is_customer_visible').notNull().default(false),
    isConsultantVisible: boolean('is_consultant_visible').notNull().default(false),
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    organizationIdx: index('files_organization_id_idx').on(table.organizationId),
    projectIdx: index('files_project_id_idx').on(table.projectId),
    supplierIdx: index('files_supplier_id_idx').on(table.supplierId),
    quoteVersionIdx: index('files_quote_version_id_idx').on(table.quoteVersionId),
    documentTypeIdx: index('files_document_type_idx').on(table.documentType),
    visibilityIdx: index('files_visibility_idx').on(
      table.isCustomerVisible,
      table.isConsultantVisible,
    ),
  }),
);

export const quoteDocuments = pgTable(
  'quote_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteVersionId: uuid('quote_version_id')
      .notNull()
      .references(() => quoteVersions.id),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id),
    documentType: text('document_type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    quoteVersionTypeSortIdx: index('quote_documents_quote_version_type_sort_idx').on(
      table.quoteVersionId,
      table.documentType,
      table.sortOrder,
    ),
  }),
);

export const proposalAcceptances = pgTable(
  'proposal_acceptances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteVersionId: uuid('quote_version_id')
      .notNull()
      .references(() => quoteVersions.id),
    acceptedByPersonId: uuid('accepted_by_person_id').references(() => people.id),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
    acceptanceMethod: text('acceptance_method').notNull(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    termsSnapshot: jsonb('terms_snapshot').notNull(),
    proposalChecksum: text('proposal_checksum'),
    signatureReference: text('signature_reference'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    quoteVersionAcceptedAtIdx: index('proposal_acceptances_quote_version_accepted_at_idx').on(
      table.quoteVersionId,
      table.acceptedAt,
    ),
  }),
);

export const consultants = pgTable(
  'consultants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
    status: text('status').notNull(),
    referralCode: text('referral_code'),
    defaultCommissionPolicyId: uuid('default_commission_policy_id').references(
      () => pricingPolicies.id,
    ),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    personUnique: unique('consultants_person_id_unique').on(table.personId),
  }),
);

export const opportunityRegistrations = pgTable(
  'opportunity_registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consultantId: uuid('consultant_id')
      .notNull()
      .references(() => consultants.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
    personId: uuid('person_id').references(() => people.id),
    projectId: uuid('project_id').references(() => projects.id),
    status: text('status').notNull(),
    ghlOpportunityId: text('ghl_opportunity_id'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    consultantIdx: index('opportunity_registrations_consultant_id_idx').on(table.consultantId),
    statusIdx: index('opportunity_registrations_status_idx').on(table.status),
    ghlOpportunityIdx: index('opportunity_registrations_ghl_opportunity_id_idx').on(
      table.ghlOpportunityId,
    ),
  }),
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceNumber: text('invoice_number').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    salesOrderId: uuid('sales_order_id').references(() => salesOrders.id),
    status: text('status').notNull(),
    currencyCode: currencyCode(),
    subtotalCents: money('subtotal_cents'),
    taxCents: money('tax_cents'),
    totalCents: money('total_cents'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    invoiceNumberUnique: unique('invoices_invoice_number_unique').on(table.invoiceNumber),
    projectIdx: index('invoices_project_id_idx').on(table.projectId),
    statusIdx: index('invoices_status_idx').on(table.status),
  }),
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id').references(() => invoices.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    status: text('status').notNull(),
    amountCents: requiredMoney('amount_cents'),
    currencyCode: currencyCode(),
    method: text('method').notNull(),
    externalPaymentId: text('external_payment_id'),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    invoiceIdx: index('payments_invoice_id_idx').on(table.invoiceId),
    projectIdx: index('payments_project_id_idx').on(table.projectId),
    statusIdx: index('payments_status_idx').on(table.status),
  }),
);

export const commissions = pgTable(
  'commissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consultantId: uuid('consultant_id')
      .notNull()
      .references(() => consultants.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    quoteVersionId: uuid('quote_version_id').references(() => quoteVersions.id),
    salesOrderId: uuid('sales_order_id').references(() => salesOrders.id),
    status: text('status').notNull(),
    basisAmountCents: requiredMoney('basis_amount_cents'),
    commissionAmountCents: requiredMoney('commission_amount_cents'),
    currencyCode: currencyCode(),
    policySnapshot: jsonb('policy_snapshot').notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    consultantIdx: index('commissions_consultant_id_idx').on(table.consultantId),
    projectIdx: index('commissions_project_id_idx').on(table.projectId),
    statusIdx: index('commissions_status_idx').on(table.status),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id),
    senderUserId: uuid('sender_user_id').references(() => users.id),
    body: text('body').notNull(),
    visibilityScope: text('visibility_scope').notNull(),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    projectIdx: index('messages_project_id_idx').on(table.projectId),
    senderUserIdx: index('messages_sender_user_id_idx').on(table.senderUserId),
  }),
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
    title: text('title').notNull(),
    status: text('status').notNull(),
    priority: text('priority'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    projectIdx: index('tasks_project_id_idx').on(table.projectId),
    assignedToUserIdx: index('tasks_assigned_to_user_id_idx').on(table.assignedToUserId),
    statusIdx: index('tasks_status_idx').on(table.status),
  }),
);

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    projectId: uuid('project_id').references(() => projects.id),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    actorType: text('actor_type').notNull(),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    metadata: jsonObject('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('activities_organization_id_idx').on(table.organizationId),
    projectIdx: index('activities_project_id_idx').on(table.projectId),
    actorUserIdx: index('activities_actor_user_id_idx').on(table.actorUserId),
    eventTypeIdx: index('activities_event_type_idx').on(table.eventType),
    entityIdx: index('activities_entity_idx').on(table.entityType, table.entityId),
  }),
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    projectId: uuid('project_id').references(() => projects.id),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    readAt: timestamp('read_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => ({
    userIdx: index('notifications_user_id_idx').on(table.userId),
    projectIdx: index('notifications_project_id_idx').on(table.projectId),
    readAtIdx: index('notifications_read_at_idx').on(table.readAt),
  }),
);
