import assert from 'node:assert/strict';
import test from 'node:test';
import { eq, sql } from 'drizzle-orm';

import { db } from '../lib/db/client';
import { recordActivity } from '../lib/db/activities';
import { allocateBusinessIdentifier } from '../lib/db/identifiers';
import { registerIntegrationEvent } from '../lib/db/integration-events';
import { enqueueOutboxEvent, fetchPendingOutboxEvents } from '../lib/db/outbox-events';
import {
  files,
  organizationMemberships,
  organizations,
  people,
  projects,
  quoteItems,
  quoteDocuments,
  quoteVersions,
  quotes,
  proposalAcceptances,
  outboxEvents,
  users,
} from '../lib/db/schema';

const databaseConfigured = Boolean(process.env.DATABASE_URL);

function requireDatabase(t: test.TestContext) {
  if (!databaseConfigured) {
    t.skip('DATABASE_URL is required for database integration tests.');
    return false;
  }

  return true;
}

async function withRollback(callback: Parameters<typeof db.transaction>[0]) {
  try {
    await db.transaction(callback);
  } catch (error) {
    if (error instanceof Error && error.message === 'Rollback') return;
    throw error;
  }
}

test('application can connect with configured database credentials', async (t) => {
  if (!requireDatabase(t)) return;
  const rows = await db.execute<{ ok: number }>(sql`select 1 as ok`);
  assert.equal(rows[0].ok, 1);
});

test('business identifier allocation is collision-free under concurrency', async (t) => {
  if (!requireDatabase(t)) return;
  await withRollback(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        businessId: `TEST-${crypto.randomUUID()}`,
        name: 'Test Organization',
        type: 'internal',
        status: 'active',
      })
      .returning();

    const identifiers = await Promise.all(
      Array.from({ length: 5 }, () =>
        allocateBusinessIdentifier(org.id, 'PRJ', { year: 2026, tx }),
      ),
    );

    assert.equal(new Set(identifiers).size, identifiers.length);
    assert.match(identifiers[0], /^PRJ-2026-\d{6}$/);
    tx.rollback();
  });
});

test('business identifier allocation supports approved prefixes and quote revisions', async (t) => {
  if (!requireDatabase(t)) return;
  await withRollback(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        businessId: `PREFIX-${crypto.randomUUID()}`,
        name: 'Prefix Organization',
        type: 'internal',
        status: 'active',
      })
      .returning();

    assert.match(await allocateBusinessIdentifier(org.id, 'Q', { year: 2026, tx }), /^Q-2026-\d{6}$/);
    assert.match(await allocateBusinessIdentifier(org.id, 'SO', { year: 2026, tx }), /^SO-2026-\d{6}$/);
    assert.match(await allocateBusinessIdentifier(org.id, 'PO', { year: 2026, tx }), /^PO-2026-\d{6}$/);
    tx.rollback();
  });
});

test('integration event registration recognizes duplicate provider event pairs', async (t) => {
  if (!requireDatabase(t)) return;
  await withRollback(async (tx) => {
    const externalEventId = crypto.randomUUID();
    const first = await registerIntegrationEvent({
      provider: 'ghl',
      externalEventId,
      eventType: 'opportunity.qualified',
      payload: { id: externalEventId },
      tx,
    });
    const second = await registerIntegrationEvent({
      provider: 'ghl',
      externalEventId,
      eventType: 'opportunity.qualified',
      payload: { id: externalEventId },
      tx,
    });

    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(first.event.id, second.event.id);
    tx.rollback();
  });
});

test('multi-record transaction rollback leaves no partial records', async (t) => {
  if (!requireDatabase(t)) return;
  const businessId = `ROLLBACK-${crypto.randomUUID()}`;

  await assert.rejects(
    db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          businessId,
          name: 'Rollback Organization',
          type: 'customer',
          status: 'active',
        })
        .returning();

      await enqueueOutboxEvent(
        {
          eventType: 'project.created',
          entityType: 'organization',
          entityId: org.id,
          payload: { organizationId: org.id },
        },
        tx,
      );

      throw new Error('force rollback');
    }),
  );

  const rows = await db.select().from(organizations).where(eq(organizations.businessId, businessId));
  assert.equal(rows.length, 0);
});

test('quote version relationship retains multiple immutable revisions', async (t) => {
  if (!requireDatabase(t)) return;
  await withRollback(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        businessId: `QUOTE-${crypto.randomUUID()}`,
        name: 'Quote Organization',
        type: 'customer',
        status: 'active',
      })
      .returning();
    const [project] = await tx
      .insert(projects)
      .values({
        projectNumber: `PRJ-2026-${crypto.randomUUID()}`,
        organizationId: org.id,
        name: 'Quote Test Project',
        status: 'active',
      })
      .returning();
    const [quote] = await tx
      .insert(quotes)
      .values({
        projectId: project.id,
        quoteNumber: `Q-2026-${crypto.randomUUID()}`,
        status: 'draft',
      })
      .returning();

    const versions = await tx
      .insert(quoteVersions)
      .values([
        {
          quoteId: quote.id,
          revisionNumber: 0,
          revisionCode: `${quote.quoteNumber}`,
          status: 'submitted',
        },
        {
          quoteId: quote.id,
          revisionNumber: 1,
          revisionCode: `${quote.quoteNumber}-R1`,
          status: 'submitted',
        },
      ])
      .returning();

    await tx.insert(quoteItems).values({
      quoteVersionId: versions[0].id,
      description: 'Cabinet package snapshot',
      quantity: '1.000',
      unitOfMeasure: 'package',
    });

    assert.equal(versions.length, 2);
    tx.rollback();
  });
});

test('organization membership links users to organizations with membership type uniqueness', async (t) => {
  if (!requireDatabase(t)) return;
  await withRollback(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        businessId: `MEM-${crypto.randomUUID()}`,
        name: 'Membership Organization',
        type: 'customer',
        status: 'active',
      })
      .returning();
    const [person] = await tx
      .insert(people)
      .values({
        organizationId: org.id,
        firstName: 'Test',
        lastName: 'User',
        email: `${crypto.randomUUID()}@example.test`,
      })
      .returning();
    const [user] = await tx
      .insert(users)
      .values({
        personId: person.id,
        organizationId: org.id,
        zitadelSubjectId: `zitadel-${crypto.randomUUID()}`,
        email: person.email!,
        roleFamily: 'customer',
        status: 'active',
      })
      .returning();

    const [membership] = await tx
      .insert(organizationMemberships)
      .values({
        organizationId: org.id,
        userId: user.id,
        membershipType: 'customer',
        status: 'active',
      })
      .returning();

    assert.equal(membership.organizationId, org.id);
    assert.equal(membership.userId, user.id);
    await assert.rejects(
      tx.insert(organizationMemberships).values({
        organizationId: org.id,
        userId: user.id,
        membershipType: 'customer',
        status: 'active',
      }),
    );
    tx.rollback();
  });
});

test('outbox enqueue commits pending events and fetches available work', async (t) => {
  if (!requireDatabase(t)) return;
  await withRollback(async (tx) => {
    const entityId = crypto.randomUUID();
    const event = await enqueueOutboxEvent(
      {
        eventType: 'quote.submitted',
        entityType: 'quote_version',
        entityId,
        payload: { entityId },
      },
      tx,
    );

    const pending = await fetchPendingOutboxEvents({ tx, limit: 10 });
    assert.ok(pending.some((row) => row.id === event.id));
    assert.equal(event.status, 'pending');

    const [stored] = await tx.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    assert.equal(stored.entityId, entityId);
    tx.rollback();
  });
});

test('quote documents and proposal acceptances reference an exact quote version', async (t) => {
  if (!requireDatabase(t)) return;
  await withRollback(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        businessId: `DOC-${crypto.randomUUID()}`,
        name: 'Document Organization',
        type: 'customer',
        status: 'active',
      })
      .returning();
    const [person] = await tx
      .insert(people)
      .values({
        organizationId: org.id,
        firstName: 'Document',
        lastName: 'Approver',
      })
      .returning();
    const [project] = await tx
      .insert(projects)
      .values({
        projectNumber: `PRJ-2026-DOC-${crypto.randomUUID()}`,
        organizationId: org.id,
        name: 'Document Project',
        status: 'active',
      })
      .returning();
    const [quote] = await tx
      .insert(quotes)
      .values({
        projectId: project.id,
        quoteNumber: `Q-2026-DOC-${crypto.randomUUID()}`,
        status: 'submitted',
      })
      .returning();
    const [version] = await tx
      .insert(quoteVersions)
      .values({
        quoteId: quote.id,
        revisionNumber: 1,
        revisionCode: `${quote.quoteNumber}-R1`,
        status: 'submitted',
      })
      .returning();
    const [file] = await tx
      .insert(files)
      .values({
        organizationId: org.id,
        projectId: project.id,
        quoteVersionId: version.id,
        documentType: 'proposal',
        category: 'quote',
        title: 'Customer Proposal',
        storageProvider: 'local-test',
        storageKey: `proposals/${crypto.randomUUID()}.pdf`,
        originalFilename: 'proposal.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        isCustomerVisible: true,
        isConsultantVisible: false,
      })
      .returning();
    const [document] = await tx
      .insert(quoteDocuments)
      .values({
        quoteVersionId: version.id,
        fileId: file.id,
        documentType: 'proposal',
        title: 'Customer Proposal',
      })
      .returning();
    const [acceptance] = await tx
      .insert(proposalAcceptances)
      .values({
        quoteVersionId: version.id,
        acceptedByPersonId: person.id,
        acceptedAt: new Date(),
        acceptanceMethod: 'manual',
        termsSnapshot: { revisionCode: version.revisionCode },
        proposalChecksum: file.checksumSha256,
      })
      .returning();

    assert.equal(document.quoteVersionId, version.id);
    assert.equal(acceptance.quoteVersionId, version.id);
    assert.equal(file.isCustomerVisible, true);
    tx.rollback();
  });
});

test('activity helper writes structured metadata for future entity events', async (t) => {
  if (!requireDatabase(t)) return;
  await withRollback(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        businessId: `ACT-${crypto.randomUUID()}`,
        name: 'Activity Organization',
        type: 'internal',
        status: 'active',
      })
      .returning();

    const activity = await recordActivity(
      {
        organizationId: org.id,
        actorType: 'system',
        eventType: 'organization.created',
        entityType: 'organization',
        entityId: org.id,
        metadata: { source: 'test' },
      },
      tx,
    );

    assert.deepEqual(activity.metadata, { source: 'test' });
    tx.rollback();
  });
});
