import { sql } from 'drizzle-orm';

import { db, type Transaction } from './client';

const WIDTH = 6;

export type IdentifierPrefix = 'PRJ' | 'Q' | 'SO' | 'PO';

type Queryable = typeof db | Transaction;

function formatIdentifier(prefix: IdentifierPrefix, year: number, value: number) {
  return `${prefix}-${year}-${String(value).padStart(WIDTH, '0')}`;
}

export async function allocateBusinessIdentifier(
  organizationId: string,
  prefix: IdentifierPrefix,
  options: { year?: number; tx?: Queryable } = {},
) {
  const queryable = options.tx ?? db;
  const year = options.year ?? new Date().getUTCFullYear();

  const rows = await queryable.execute<{ allocated_value: number }>(sql`
    insert into identifier_sequences (organization_id, prefix, year, next_value, created_at, updated_at)
    values (${organizationId}, ${prefix}, ${year}, 2, now(), now())
    on conflict (organization_id, prefix, year)
    do update set next_value = identifier_sequences.next_value + 1, updated_at = now()
    returning next_value - 1 as allocated_value
  `);

  const allocatedValue = rows[0]?.allocated_value;

  if (!allocatedValue) {
    throw new Error('Business identifier allocation failed.');
  }

  return formatIdentifier(prefix, year, allocatedValue);
}

export function formatQuoteRevision(baseQuoteNumber: string, revisionNumber: number) {
  if (revisionNumber < 0 || !Number.isInteger(revisionNumber)) {
    throw new Error('Quote revision number must be a non-negative integer.');
  }

  return revisionNumber === 0 ? baseQuoteNumber : `${baseQuoteNumber}-R${revisionNumber}`;
}
