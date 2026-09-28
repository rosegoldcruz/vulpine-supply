import { eq, sql } from 'drizzle-orm';

import { db, type Transaction } from './client';
import { integrationEvents } from './schema';

type Queryable = typeof db | Transaction;
type JsonRecord = Record<string, unknown>;

export type IntegrationEventStatus = 'received' | 'processing' | 'processed' | 'failed' | 'ignored';

export async function registerIntegrationEvent(input: {
  provider: string;
  externalEventId: string;
  eventType: string;
  payload: JsonRecord;
  tx?: Queryable;
}) {
  const queryable = input.tx ?? db;
  const rows = await queryable
    .insert(integrationEvents)
    .values({
      provider: input.provider,
      externalEventId: input.externalEventId,
      eventType: input.eventType,
      payload: input.payload,
      status: 'received',
    })
    .onConflictDoNothing({
      target: [integrationEvents.provider, integrationEvents.externalEventId],
    })
    .returning();

  if (rows[0]) {
    return { event: rows[0], duplicate: false };
  }

  const existing = await queryable
    .select()
    .from(integrationEvents)
    .where(
      sql`${integrationEvents.provider} = ${input.provider} and ${integrationEvents.externalEventId} = ${input.externalEventId}`,
    )
    .limit(1);

  if (!existing[0]) {
    throw new Error('Integration event idempotency lookup failed.');
  }

  return { event: existing[0], duplicate: true };
}

export async function markIntegrationEventProcessing(id: string, tx: Queryable = db) {
  return updateIntegrationEventStatus(id, 'processing', { incrementAttempt: true }, tx);
}

export async function incrementIntegrationEventAttempts(id: string, tx: Queryable = db) {
  const rows = await tx
    .update(integrationEvents)
    .set({
      attemptCount: sql`${integrationEvents.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(integrationEvents.id, id))
    .returning();

  if (!rows[0]) throw new Error('Integration event not found.');
  return rows[0];
}

export async function markIntegrationEventProcessed(id: string, tx: Queryable = db) {
  return updateIntegrationEventStatus(id, 'processed', { processedAt: true, lastError: null }, tx);
}

export async function markIntegrationEventFailed(id: string, error: unknown, tx: Queryable = db) {
  return updateIntegrationEventStatus(
    id,
    'failed',
    { lastError: error instanceof Error ? error.message : String(error) },
    tx,
  );
}

async function updateIntegrationEventStatus(
  id: string,
  status: IntegrationEventStatus,
  options: { incrementAttempt?: boolean; processedAt?: boolean; lastError?: string | null },
  queryable: Queryable,
) {
  const rows = await queryable
    .update(integrationEvents)
    .set({
      status,
      attemptCount: options.incrementAttempt
        ? sql`${integrationEvents.attemptCount} + 1`
        : undefined,
      processedAt: options.processedAt ? new Date() : undefined,
      lastError: options.lastError,
      updatedAt: new Date(),
    })
    .where(eq(integrationEvents.id, id))
    .returning();

  if (!rows[0]) throw new Error('Integration event not found.');
  return rows[0];
}
