import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

import { getDatabaseUrl } from '../lib/db/env';

const migrationsDir = path.join(process.cwd(), 'db', 'migrations');

async function main() {
  const sql = postgres(getDatabaseUrl(), { max: 1, onnotice: () => undefined });

  await sql`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const applied = await sql<{ version: string }[]>`
      select version from schema_migrations where version = ${file}
    `;

    if (applied.length > 0) {
      console.log(`skip ${file}`);
      continue;
    }

    const migrationSql = await readFile(path.join(migrationsDir, file), 'utf8');

    await sql.begin(async (tx) => {
      await tx.unsafe(migrationSql);
      await tx`insert into schema_migrations (version) values (${file})`;
    });

    console.log(`applied ${file}`);
  }

  await sql.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
