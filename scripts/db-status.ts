import { sql } from 'drizzle-orm';

import { db } from '../lib/db/client';
import { getDatabaseUrl } from '../lib/db/env';

async function main() {
  getDatabaseUrl();

  const result = await db.execute<{
    current_database: string;
    current_user: string;
    table_count: number;
  }>(sql`
    select
      current_database() as current_database,
      current_user as current_user,
      (
        select count(*)::int
        from information_schema.tables
        where table_schema = 'public'
          and table_type = 'BASE TABLE'
      ) as table_count
  `);

  console.log(JSON.stringify(result[0], null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
