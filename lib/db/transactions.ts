import { db, type Database } from './client';

export async function withTransaction<T>(
  callback: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>,
) {
  return db.transaction(callback);
}
