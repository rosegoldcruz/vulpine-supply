import { db, type Transaction } from './client';
import { activities } from './schema';

type Queryable = typeof db | Transaction;
type JsonRecord = Record<string, unknown>;

export async function recordActivity(
  input: {
    organizationId?: string | null;
    projectId?: string | null;
    actorUserId?: string | null;
    actorType: string;
    eventType: string;
    entityType: string;
    entityId: string;
    metadata?: JsonRecord;
  },
  tx: Queryable = db,
) {
  const rows = await tx
    .insert(activities)
    .values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
    })
    .returning();

  return rows[0];
}
