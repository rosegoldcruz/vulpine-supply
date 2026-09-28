import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { redactDatabaseUrl } from './env';
import * as schema from './schema';

type DbGlobal = typeof globalThis & {
  vulpineSql?: postgres.Sql;
};

const globalForDb = globalThis as DbGlobal;

function createSqlClient() {
  const url = process.env.DATABASE_URL || '';

  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => undefined,
    debug: (_connection, query) => {
      if (process.env.DATABASE_DEBUG === 'true') {
        console.debug('[database]', query.replace(url, redactDatabaseUrl(url)));
      }
    },
  });
}

export const sql = globalForDb.vulpineSql ?? createSqlClient();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.vulpineSql = sql;
}

export const db = drizzle(sql, { schema });

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
