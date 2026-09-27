import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresClientPublicationRepository } from "@/features/client-publication/postgres-repository";
import { validateDraft } from "@/features/client-publication/service";
import {
  activityEntries,
  auditEvents,
  clientReportPublications,
  incidentReports,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";

const suite =
  process.env.NEXUS_POSTGRES_TEST === "true"
    ? describe.sequential
    : describe.skip;
const ids = {
  organization: "00000000-0000-4000-8000-000000000001",
  client: "00000000-0000-4000-8000-000000000020",
  site: "00000000-0000-4000-8000-000000000030",
  actor: "00000000-0000-4000-8000-000000000050",
  assignment: "00000000-0000-4000-8000-000000000090",
  activity: randomUUID(),
  incident: randomUUID(),
};
const scope = {
  organizationId: ids.organization,
  organizationWide: true,
  branchIds: [] as string[],
  clientIds: [] as string[],
  siteIds: [] as string[],
};
const audit = {
  actorUserId: ids.actor,
  organizationId: ids.organization,
  requestId: "nx812-postgres-test",
};

suite("NX-8.12 PostgreSQL publication invariants", () => {
  let pool: Pool;
  let database: ReturnType<typeof drizzle<typeof schema>>;
  let repository: PostgresClientPublicationRepository;
  let draft: Awaited<ReturnType<typeof repository.saveDraft>>;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.endsWith("/nexus_oct1_publication_test"))
      throw new Error(
        "NX-8.12 tests require the exact isolated publication database.",
      );
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    database = drizzle(pool, { schema });
    repository = new PostgresClientPublicationRepository(database);
    // Shared demo records are modified by other PostgreSQL suites. Give this
    // suite independent canonical sources so concurrent Vitest files cannot
    // change publication eligibility mid-transaction.
    await database.insert(activityEntries).values({
      id: ids.activity,
      shiftAssignmentId: ids.assignment,
      occurredAt: new Date("2026-09-26T12:05:00.000Z"),
      category: "PATROL",
      description: { text: "Isolated client-visible patrol activity." },
      status: "SUBMITTED",
      visibility: "CLIENT_VISIBLE",
    });
    await database.insert(incidentReports).values({
      id: ids.incident,
      siteId: ids.site,
      shiftAssignmentId: ids.assignment,
      reportedByUserId: ids.actor,
      incidentNumber: `NX812-${ids.incident.slice(0, 8)}`,
      classification: "SECURITY",
      severity: "LOW",
      occurredAt: new Date("2026-09-26T12:05:00.000Z"),
      narrative:
        "Isolated incident narrative that must not enter the client snapshot.",
      actionsTaken: "Reviewed by operations.",
      status: "SUBMITTED",
      visibility: "CLIENT_VISIBLE",
    });
    // Each run gets a distinct scope key/period without touching other fixtures.
    const start = new Date("2026-09-26T11:00:00.000Z");
    start.setTime(start.valueOf() + Math.floor(Math.random() * 3_600_000));
    draft = await repository.saveDraft(
      scope,
      validateDraft({
        clientId: ids.client,
        siteIds: [ids.site],
        periodStart: start.toISOString(),
        periodEnd: "2026-09-26T13:00:00.000Z",
        executiveSummary: "Reviewed client-safe operational summary.",
        completionSummary: "Reviewed period completion and follow-up.",
        followUps: ["Confirm follow-up with the site."],
        selectedSources: [
          {
            kind: "ACTIVITY",
            id: ids.activity,
            clientSummary: "Patrol activity reviewed.",
          },
          {
            kind: "INCIDENT",
            id: ids.incident,
            clientSummary: "Incident response reviewed.",
          },
        ],
      }),
      audit,
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("denies tenant and site crossover without publication or audit", async () => {
    const before = await database
      .select()
      .from(clientReportPublications)
      .where(eq(clientReportPublications.draftId, draft.id));
    const wrongTenant = { ...scope, organizationId: randomUUID() };
    const wrongSite = {
      ...scope,
      organizationWide: false,
      siteIds: [randomUUID()],
    };
    const wrongClient = {
      ...scope,
      organizationWide: false,
      clientIds: [randomUUID()],
    };
    const wrongBranch = {
      ...scope,
      organizationWide: false,
      branchIds: [randomUUID()],
    };
    for (const denied of [wrongTenant, wrongSite, wrongClient, wrongBranch]) {
      await expect(
        repository.publish(
          denied,
          {
            draftId: draft.id,
            expectedDraftRevision: draft.revision,
            expectedVersion: 0,
            confirmationKey: randomUUID(),
            confirmed: true,
          },
          audit,
        ),
      ).rejects.toThrow();
      expect(await repository.draft(denied, draft.id)).toBeNull();
    }
    expect(
      await database
        .select()
        .from(clientReportPublications)
        .where(eq(clientReportPublications.draftId, draft.id)),
    ).toEqual(before);
  });

  it("rejects stale revision and invalid source atomically", async () => {
    const beforeAudit = await database
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "client-report.published"));
    await expect(
      repository.publish(
        scope,
        {
          draftId: draft.id,
          expectedDraftRevision: draft.revision + 1,
          expectedVersion: 0,
          confirmationKey: randomUUID(),
          confirmed: true,
        },
        audit,
      ),
    ).rejects.toThrow(/changed/);
    const bad = await repository.saveDraft(
      scope,
      validateDraft({
        ...draft,
        selectedSources: [
          {
            kind: "ACTIVITY",
            id: randomUUID(),
            clientSummary: "Unavailable source.",
          },
        ],
        expectedRevision: draft.revision,
      }),
      audit,
    );
    await expect(
      repository.publish(
        scope,
        {
          draftId: bad.id,
          expectedDraftRevision: bad.revision,
          expectedVersion: 0,
          confirmationKey: randomUUID(),
          confirmed: true,
        },
        audit,
      ),
    ).rejects.toThrow(/selected source/);
    expect(
      await database
        .select()
        .from(clientReportPublications)
        .where(eq(clientReportPublications.draftId, draft.id)),
    ).toHaveLength(0);
    expect(
      await database
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.action, "client-report.published")),
    ).toEqual(beforeAudit);
    draft = await repository.saveDraft(
      scope,
      validateDraft({
        ...bad,
        selectedSources: [
          {
            kind: "ACTIVITY",
            id: ids.activity,
            clientSummary: "Patrol activity reviewed.",
          },
          {
            kind: "INCIDENT",
            id: ids.incident,
            clientSummary: "Incident response reviewed.",
          },
        ],
        expectedRevision: bad.revision,
      }),
      audit,
    );
    await pool.query(
      "update activity_entries set visibility='INTERNAL' where id=$1",
      [ids.activity],
    );
    try {
      await expect(
        repository.publish(
          scope,
          {
            draftId: draft.id,
            expectedDraftRevision: draft.revision,
            expectedVersion: 0,
            confirmationKey: randomUUID(),
            confirmed: true,
          },
          audit,
        ),
      ).rejects.toThrow(/selected source/);
    } finally {
      await pool.query(
        "update activity_entries set visibility='CLIENT_VISIBLE' where id=$1",
        [ids.activity],
      );
    }
  });

  it("rolls back publication when its audit insertion fails after the snapshot write", async () => {
    const beforeAudits = await database
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "client-report.published"));
    await pool.query(`create or replace function nx812_test_reject_audit() returns trigger language plpgsql as $$
      begin if new.action = 'client-report.published' then raise exception 'controlled audit failure'; end if; return new; end $$`);
    await pool.query(
      "create trigger nx812_test_reject_audit before insert on audit_events for each row execute function nx812_test_reject_audit()",
    );
    try {
      const failure = await repository
        .publish(
          scope,
          {
            draftId: draft.id,
            expectedDraftRevision: draft.revision,
            expectedVersion: 0,
            confirmationKey: randomUUID(),
            confirmed: true,
          },
          audit,
        )
        .then(
          () => null,
          (error: Error & { cause?: Error }) => error,
        );
      expect(failure).toBeTruthy();
      expect(String(failure?.cause ?? failure)).toMatch(
        /controlled audit failure/,
      );
      expect(
        await database
          .select()
          .from(clientReportPublications)
          .where(eq(clientReportPublications.draftId, draft.id)),
      ).toHaveLength(0);
      expect(
        await database
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.action, "client-report.published")),
      ).toEqual(beforeAudits);
    } finally {
      await pool.query("drop trigger nx812_test_reject_audit on audit_events");
      await pool.query("drop function nx812_test_reject_audit()");
    }
  });

  it("serializes concurrent publication, snapshots safe content, replays, and supersedes immutably", async () => {
    const keys = [randomUUID(), randomUUID()];
    const blocker = await pool.connect();
    await blocker.query("begin");
    await blocker.query(
      "select id from client_report_drafts where id=$1 for update",
      [draft.id],
    );
    const pending = keys.map((confirmationKey) =>
      repository.publish(
        scope,
        {
          draftId: draft.id,
          expectedDraftRevision: draft.revision,
          expectedVersion: 0,
          confirmationKey,
          confirmed: true,
        },
        audit,
      ),
    );
    try {
      let waiting = 0;
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await pool.query<{
          count: string;
        }>(`select count(*)::text as count from pg_stat_activity
          where wait_event_type='Lock' and query like '%client_report_drafts%' and pid <> pg_backend_pid()`);
        waiting = Number(result.rows[0].count);
        if (waiting >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBeGreaterThanOrEqual(2);
    } finally {
      await blocker.query("rollback");
      blocker.release();
    }
    const outcomes = await Promise.allSettled(pending);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(outcomes.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
    const first = outcomes.find((item) => item.status === "fulfilled")!.value;
    expect(first.version).toBe(1);
    expect(first.isCurrent).toBe(true);
    expect(first.snapshot.sources.map((item) => item.kind)).toEqual([
      "ACTIVITY",
      "INCIDENT",
    ]);
    expect(JSON.stringify(first)).not.toMatch(
      /narrative|participant|evidence|audit/i,
    );
    const winnerKey =
      keys[outcomes.findIndex((item) => item.status === "fulfilled")];
    const replay = await repository.publish(
      scope,
      {
        draftId: draft.id,
        expectedDraftRevision: draft.revision,
        expectedVersion: 0,
        confirmationKey: winnerKey,
        confirmed: true,
      },
      audit,
    );
    expect(replay.id).toBe(first.id);
    const second = await repository.publish(
      scope,
      {
        draftId: draft.id,
        expectedDraftRevision: draft.revision,
        expectedVersion: 1,
        confirmationKey: randomUUID(),
        confirmed: true,
      },
      audit,
    );
    expect(second.version).toBe(2);
    expect(second.isCurrent).toBe(true);
    expect(second.supersedesId).toBe(first.id);
    expect(await repository.publication(scope, first.id)).toMatchObject({
      id: first.id,
      isCurrent: false,
    });
    expect(await repository.publication(scope, second.id)).toMatchObject({
      id: second.id,
      isCurrent: true,
    });
    const versions = await database
      .select()
      .from(clientReportPublications)
      .where(eq(clientReportPublications.draftId, draft.id));
    expect(versions).toHaveLength(2);
    expect(versions.find((row) => row.id === first.id)?.snapshot).toEqual(
      first.snapshot,
    );
    const publishedAudits = await database
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.entityType, "ClientReportPublication"),
          eq(auditEvents.action, "client-report.published"),
        ),
      );
    expect(
      publishedAudits.filter((row) =>
        [first.id, second.id].includes(row.entityId),
      ),
    ).toHaveLength(2);
    await expect(
      pool.query(
        "update client_report_publications set version=9 where id=$1",
        [first.id],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query("delete from client_report_publications where id=$1", [
        first.id,
      ]),
    ).rejects.toThrow();
    expect(await repository.publication(scope, first.id)).toMatchObject({
      id: first.id,
      version: 1,
    });
    expect(
      await repository.listPublished({
        ...scope,
        organizationWide: false,
        siteIds: [randomUUID()],
      }),
    ).toHaveLength(0);
  });
});
