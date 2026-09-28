import { sql } from 'drizzle-orm';

import { db } from '../lib/db/client';
import { getDatabaseUrl } from '../lib/db/env';

const expectedTables = [
  'organizations',
  'people',
  'users',
  'organization_memberships',
  'identifier_sequences',
  'integration_links',
  'integration_events',
  'outbox_events',
  'properties',
  'projects',
  'project_contacts',
  'suppliers',
  'supplier_contacts',
  'collections',
  'products',
  'skus',
  'price_books',
  'supplier_pricing',
  'takeoffs',
  'takeoff_items',
  'quotes',
  'quote_versions',
  'quote_items',
  'quote_alternates',
  'quote_documents',
  'proposal_acceptances',
  'pricing_policies',
  'sales_orders',
  'sales_order_items',
  'purchase_orders',
  'purchase_order_items',
  'shipments',
  'deliveries',
  'damage_claims',
  'invoices',
  'payments',
  'consultants',
  'opportunity_registrations',
  'commissions',
  'files',
  'messages',
  'tasks',
  'activities',
  'notifications',
] as const;

const requiredConstraints = [
  'identifier_sequences_org_prefix_year_unique',
  'integration_events_provider_external_event_unique',
  'integration_links_external_unique',
  'organization_memberships_org_user_type_unique',
  'projects_project_number_unique',
  'quotes_quote_number_unique',
  'quote_versions_quote_revision_unique',
  'quote_versions_revision_code_unique',
  'sales_orders_sales_order_number_unique',
  'purchase_orders_purchase_order_number_unique',
] as const;

const requiredIndexes = [
  'integration_links_local_idx',
  'integration_links_organization_provider_idx',
  'integration_events_status_created_at_idx',
  'outbox_events_status_available_at_idx',
  'outbox_events_entity_idx',
  'projects_ghl_opportunity_id_unique',
  'quote_documents_quote_version_type_sort_idx',
  'proposal_acceptances_quote_version_accepted_at_idx',
  'organization_memberships_organization_id_idx',
  'quote_versions_quote_id_idx',
] as const;

async function main() {
  getDatabaseUrl();

  const tableRows = await db.execute<{ table_name: string }>(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  `);

  const existingTables = new Set(tableRows.map((row) => row.table_name));
  const missingTables = expectedTables.filter((table) => !existingTables.has(table));

  const constraintRows = await db.execute<{ conname: string }>(sql`
    select conname
    from pg_constraint
    where connamespace = 'public'::regnamespace
  `);

  const existingConstraints = new Set(constraintRows.map((row) => row.conname));
  const missingConstraints = requiredConstraints.filter(
    (constraint) => !existingConstraints.has(constraint),
  );

  const indexRows = await db.execute<{ indexname: string }>(sql`
    select indexname
    from pg_indexes
    where schemaname = 'public'
  `);

  const existingIndexes = new Set(indexRows.map((row) => row.indexname));
  const missingIndexes = requiredIndexes.filter((indexName) => !existingIndexes.has(indexName));

  const foreignKeyRows = await db.execute<{ foreign_key_count: number }>(sql`
    select count(*)::int as foreign_key_count
    from pg_constraint
    where connamespace = 'public'::regnamespace
      and contype = 'f'
  `);

  const idColumnRows = await db.execute<{ table_name: string; data_type: string }>(sql`
    select table_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'id'
      and table_name in ${sql`(${sql.join(
        expectedTables.map((table) => sql`${table}`),
        sql`, `,
      )})`}
  `);

  const uuidIdTables = new Set(
    idColumnRows.filter((row) => row.data_type === 'uuid').map((row) => row.table_name),
  );
  const missingUuidPrimaryKeys = expectedTables.filter((table) => !uuidIdTables.has(table));

  const moneyRows = await db.execute<{ column_name: string; data_type: string }>(sql`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quote_versions'
      and column_name in (
        'materials_cost_cents',
        'freight_cost_cents',
        'tax_cost_cents',
        'misc_cost_cents',
        'installation_cost_cents',
        'total_direct_cost_cents',
        'sell_price_cents',
        'contribution_profit_cents',
        'consultant_commission_cents',
        'company_net_cents',
        'margin_bps',
        'markup_bps'
      )
  `);

  const invalidMoneyColumns = moneyRows.filter(
    (row) =>
      (row.column_name.endsWith('_cents') && row.data_type !== 'bigint') ||
      (row.column_name.endsWith('_bps') && row.data_type !== 'integer'),
  );

  if (
    missingTables.length ||
    missingConstraints.length ||
    missingIndexes.length ||
    missingUuidPrimaryKeys.length ||
    foreignKeyRows[0].foreign_key_count < 90 ||
    invalidMoneyColumns.length
  ) {
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          missingTables,
          missingConstraints,
          missingIndexes,
          missingUuidPrimaryKeys,
          foreignKeyCount: foreignKeyRows[0].foreign_key_count,
          invalidMoneyColumns,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        tableCount: expectedTables.length,
        checkedConstraints: requiredConstraints.length,
        checkedIndexes: requiredIndexes.length,
        foreignKeyCount: foreignKeyRows[0].foreign_key_count,
        moneyColumns: moneyRows.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
