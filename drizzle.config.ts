import { defineConfig } from 'drizzle-kit';

const connectionString =
  process.env.DATABASE_MIGRATION_URL ||
  process.env.DATABASE_URL ||
  '';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
  },
  strict: true,
  verbose: true,
});
