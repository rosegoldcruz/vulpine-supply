import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

let localEnvLoaded = false;

function loadLocalDatabaseEnv() {
  if (localEnvLoaded) return;
  localEnvLoaded = true;

  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.join(process.cwd(), fileName);
    if (!existsSync(filePath)) continue;

    const contents = readFileSync(filePath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^(DATABASE_URL|DATABASE_MIGRATION_URL)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

loadLocalDatabaseEnv();

export function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;

  if (!value) {
    throw new Error('DATABASE_URL is required for server-side database access.');
  }

  return value;
}

export function redactDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    if (url.username) url.username = '***';
    return url.toString();
  } catch {
    return '[invalid DATABASE_URL]';
  }
}
