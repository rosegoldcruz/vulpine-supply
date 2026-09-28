import { and, asc, eq, lte, sql } from 'drizzle-orm';

import { db, type Transaction } from './client';
import { outboxEvents } from './schema';

type Queryable = typeof db | Transaction;
type JsonRecord = Record<string, unknown>;

export type OutboxEventStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'ignored';

export async function enqueueOutboxEvent(
  input: {
    eventType: string;
    entityType: string;
    entityId: string;
    payload: JsonRecord;
    availableAt?: Date;
  },
  tx: Queryable,
) {
  const rows = await tx
    .insert(outboxEvents)
    .values({
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
      status: 'pending',
      availableAt: input.availableAt ?? new Date(),
    })
    .returning();

  return rows[0];
}

export async function fetchPendingOutboxEvents(options: { limit?: number; tx?: Queryable } = {}) {
  const queryable = options.tx ?? db;

  return queryable
    .select()
    .from(outboxEvents)
    .where(and(eq(outboxEvents.status, 'pending'), lte(outboxEvents.availableAt, new Date())))
    .orderBy(asc(outboxEvents.availableAt), asc(outboxEvents.createdAt))
    .limit(options.limit ?? 50);
}

export async function markOutboxEventProcessing(id: string, tx: Queryable = db) {
  return updateOutboxEventStatus(id, 'processing', { incrementAttempt: true }, tx);
}

export async function incrementOutboxEventAttempts(id: string, tx: Queryable = db) {
  const rows = await tx
    .update(outboxEvents)
    .set({
      attemptCount: sql`${outboxEvents.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(outboxEvents.id, id))
    .returning();

  if (!rows[0]) throw new Error('Outbox event not found.');
  return rows[0];
}

export async function markOutboxEventProcessed(id: string, tx: Queryable = db) {
  return updateOutboxEventStatus(id, 'processed', { processedAt: true, lastError: null }, tx);
}

export async function markOutboxEventFailed(
  id: string,
  error: unknown,
  options: { retryAt?: Date; ignored?: boolean } = {},
  tx: Queryable = db,
) {
  return updateOutboxEventStatus(
    id,
    options.ignored ? 'ignored' : 'failed',
    {
      availableAt: options.retryAt,
      lastError: error instanceof Error ? error.message : String(error),
    },
    tx,
  );
}

async function updateOutboxEventStatus(
  id: string,
  status: OutboxEventStatus,
  options: {
    incrementAttempt?: boolean;
    processedAt?: boolean;
    lastError?: string | null;
    availableAt?: Date;
  },
  queryable: Queryable,
) {
  const rows = await queryable
    .update(outboxEvents)
    .set({
      status,
      attemptCount: options.incrementAttempt ? sql`${outboxEvents.attemptCount} + 1` : undefined,
      processedAt: options.processedAt ? new Date() : undefined,
      lastError: options.lastError,
      availableAt: options.availableAt,
      updatedAt: new Date(),
    })
    .where(eq(outboxEvents.id, id))
    .returning();

  if (!rows[0]) throw new Error('Outbox event not found.');
  return rows[0];
}
