import { PostgresMembershipResolver } from "@/auth/membership";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { ClientPublicationService } from "@/features/client-publication/service";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresClientPublicationRepository } from "@/features/client-publication/postgres-repository";
import { validateDraft } from "@/features/client-publication/service";
import { activityEntries, incidentReports } from "@/server/db/schema";
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
  requestId: "nx812a-security-test",
};

suite("NX-8.12A confirmed publication security regressions", () => {
  let pool: Pool;
  let database: ReturnType<typeof drizzle<typeof schema>>;
  let repository: PostgresClientPublicationRepository;
  let draft: Awaited<ReturnType<typeof repository.saveDraft>>;

  beforeAll(async () => {
    if (
      process.env.NEXUS_ISOLATED_TEST_DATABASE !== "true" ||
      !process.env.DATABASE_URL ||
      !/^\/nexus_(oct1_publication|ci)_test$/.test(
        new URL(process.env.DATABASE_URL).pathname,
      ) ||
      !["127.0.0.1", "localhost"].includes(
        new URL(process.env.DATABASE_URL).hostname,
      )
    )
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

  it("CP-01 rejects a same-key retry with a different confirmed revision or version", async () => {
    const request = {
      draftId: draft.id,
      expectedDraftRevision: draft.revision,
      expectedVersion: 0,
      confirmationKey: randomUUID(),
      confirmed: true,
    };
    const published = await repository.publish(scope, request, audit);
    expect(await repository.publish(scope, request, audit)).toMatchObject({
      id: published.id,
    });
    const original = await pool.query(
      "select * from client_report_publications where id=$1",
      [published.id],
    );
    await expect(
      repository.publish(
        scope,
        { ...request, expectedDraftRevision: draft.revision + 1 },
        audit,
      ),
    ).rejects.toThrow(/confirm|changed|review/i);
    await expect(
      repository.publish(scope, { ...request, expectedVersion: 1 }, audit),
    ).rejects.toThrow(/confirm|changed|review/i);
    expect(
      (
        await pool.query(
          "select * from client_report_publications where id=$1",
          [published.id],
        )
      ).rows,
    ).toEqual(original.rows);
  });

  it("CP-02 requires re-review when source content changes without updated_at maintenance", async () => {
    const staged = await repository.saveDraft(
      scope,
      validateDraft({
        ...draft,
        periodStart: new Date(
          new Date(draft.periodStart).valueOf() + 1,
        ).toISOString(),
        expectedRevision: 0,
      }),
      audit,
    );
    await pool.query(
      "update activity_entries set category='OBSERVATION' where id=$1",
      [ids.activity],
    );
    try {
      await expect(
        repository.publish(
          scope,
          {
            draftId: staged.id,
            expectedDraftRevision: staged.revision,
            expectedVersion: 0,
            confirmationKey: randomUUID(),
            confirmed: true,
          },
          audit,
        ),
      ).rejects.toThrow(/source|changed|review/i);
      expect(
        (
          await pool.query(
            "select id from client_report_publications where draft_id=$1",
            [staged.id],
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await pool.query(
        "update activity_entries set category='PATROL' where id=$1",
        [ids.activity],
      );
    }
  });

  async function stage(offset: number, siteIds = [ids.site]) {
    return repository.saveDraft(
      scope,
      validateDraft({
        ...draft,
        selectedSources: draft.selectedSources,
        periodStart: new Date(
          new Date(draft.periodStart).valueOf() + offset,
        ).toISOString(),
        siteIds,
        expectedRevision: 0,
      }),
      audit,
    );
  }

  function request(staged: typeof draft) {
    return {
      draftId: staged.id,
      expectedDraftRevision: staged.revision,
      expectedVersion: 0,
      confirmationKey: randomUUID(),
      confirmed: true,
    };
  }

  async function waitForBlockedQuery(fragment: string) {
    for (let i = 0; i < 150; i++) {
      const result = await pool.query(
        "select count(*)::int as n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like $1 and pid<>pg_backend_pid()",
        [`%${fragment}%`],
      );
      if (result.rows[0].n > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Expected a lock waiter for ${fragment}`);
  }

  it("CP-02 locks sources until publication commits, blocking a concurrent visibility downgrade", async () => {
    const staged = await stage(2);
    expect(staged.reviewedSnapshot?.sources[0]).toMatchObject({
      category: "PATROL",
    });
    expect(JSON.stringify(staged.reviewedSnapshot)).not.toMatch(
      /description|narrative|sourceState|participant/i,
    );
    const barrier = await pool.connect();
    await barrier.query("select pg_advisory_lock(8121202)");
    await pool.query(
      `create function nx812a_publish_barrier() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock(8121202); return new; end $$`,
    );
    await pool.query(
      `create trigger nx812a_publish_barrier before insert on client_report_publications for each row when (new.draft_id='${staged.id}') execute function nx812a_publish_barrier()`,
    );
    const pending = repository.publish(scope, request(staged), audit);
    const observed = pending.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    let updating: Promise<unknown> | undefined;
    try {
      await waitForBlockedQuery('insert into "client_report_publications"');
      updating = pool.query(
        "update activity_entries set visibility='INTERNAL' where id=$1",
        [ids.activity],
      );
      await waitForBlockedQuery("update activity_entries set visibility");
      await barrier.query("select pg_advisory_unlock(8121202)");
      const result = await observed;
      expect(result).toHaveProperty("value");
      await updating;
      expect(
        (result as { value: Awaited<typeof pending> }).value.snapshot
          .sources[0],
      ).toMatchObject({ category: "PATROL" });
    } finally {
      await barrier.query("select pg_advisory_unlock_all()");
      barrier.release();
      await observed;
      await updating;
      await pool.query(
        "drop trigger nx812a_publish_barrier on client_report_publications",
      );
      await pool.query("drop function nx812a_publish_barrier()");
      await pool.query(
        "update activity_entries set visibility='CLIENT_VISIBLE' where id=$1",
        [ids.activity],
      );
    }
  }, 15000);

  it("CP-02 revalidates an update committed while publication waits for a source lock", async () => {
    const staged = await stage(3);
    const writer = await pool.connect();
    await writer.query("begin");
    await writer.query(
      "update activity_entries set visibility='INTERNAL' where id=$1",
      [ids.activity],
    );
    const pending = repository.publish(scope, request(staged), audit).then(
      () => null,
      (error) => error,
    );
    try {
      await waitForBlockedQuery('from "activity_entries"');
      await writer.query("commit");
      expect(await pending).toBeTruthy();
      expect(
        (
          await pool.query(
            "select id from client_report_publications where draft_id=$1",
            [staged.id],
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await writer.query("rollback");
      writer.release();
      await pending;
      await pool.query(
        "update activity_entries set visibility='CLIENT_VISIBLE' where id=$1",
        [ids.activity],
      );
    }
  }, 15000);

  it("legacy drafts require explicit restaging; publication confirmation identity is reconstructable", async () => {
    const staged = await stage(4);
    await pool.query(
      "update client_report_drafts set reviewed_snapshot=null, source_fingerprint=null where id=$1",
      [staged.id],
    );
    await expect(
      repository.publish(scope, request(staged), audit),
    ).rejects.toThrow(/review|source/i);
    const refreshed = await repository.saveDraft(
      scope,
      validateDraft({ ...staged, expectedRevision: staged.revision }),
      audit,
    );
    const req = request(refreshed);
    const published = await repository.publish(scope, req, audit);
    const row = (
      await pool.query(
        "select confirmed_draft_revision, source_fingerprint, snapshot_hash from client_report_publications where id=$1",
        [published.id],
      )
    ).rows[0];
    expect(row.confirmed_draft_revision).toBe(refreshed.revision);
    expect(row.source_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(row.snapshot_hash).toMatch(/^[a-f0-9]{64}$/);
    const event = (
      await pool.query(
        "select metadata from audit_events where entity_id=$1 and action='client-report.published'",
        [published.id],
      )
    ).rows[0].metadata;
    expect(event).toMatchObject({
      confirmationKey: req.confirmationKey,
      confirmedDraftRevision: refreshed.revision,
      snapshotHash: row.snapshot_hash,
    });
  });

  async function clientService() {
    const resolver = new PostgresMembershipResolver(database);
    const context = await createAuthenticatedRequestContext(
      {
        resolve: async () => {
          const principal = await resolver.resolve(
            "nexus-dev-auth-client-user-a",
          );
          return principal ? { principal } : null;
        },
      },
      "nx812a-current-membership",
    );
    return new ClientPublicationService(
      new AuthorizedDataAccess(context),
      repository,
    );
  }

  it("rechecks current membership and client/site grants for immutable published reports", async () => {
    const staged = await stage(5);
    const published = await repository.publish(scope, request(staged), audit);
    expect(
      await (await clientService()).publication(published.id),
    ).toMatchObject({ id: published.id });
    const clientUser = "00000000-0000-4000-8000-000000000130";
    const clientEmployee = "00000000-0000-4000-8000-000000000131";
    const secondSite = randomUUID();
    try {
      await pool.query(
        "update user_memberships set status='inactive' where user_id=$1",
        [clientUser],
      );
      await expect(clientService()).rejects.toThrow();
      await pool.query(
        "update user_memberships set status='active' where user_id=$1",
        [clientUser],
      );
      await pool.query(
        "update employee_roles set client_id=null, site_id=$1 where employee_id=$2",
        [ids.site, clientEmployee],
      );
      expect(
        await (await clientService()).publication(published.id),
      ).toMatchObject({ id: published.id });
      await pool.query(
        "insert into sites(id,client_id,name,address,timezone) values($1,$2,'Second security test site','{}','UTC')",
        [secondSite, ids.client],
      );
      const multi = await stage(6, [ids.site, secondSite]);
      const combined = await repository.publish(scope, request(multi), audit);
      expect(await (await clientService()).publication(combined.id)).toBeNull();
      await pool.query(
        "update employee_roles set site_id=$1 where employee_id=$2",
        [secondSite, clientEmployee],
      );
      expect(
        await (await clientService()).publication(published.id),
      ).toBeNull();
      expect(
        (await (await clientService()).listPublished()).some(
          (row) => row.id === published.id,
        ),
      ).toBe(false);
    } finally {
      await pool.query(
        "update user_memberships set status='active' where user_id=$1",
        [clientUser],
      );
      await pool.query(
        "update employee_roles set client_id=$1, site_id=null where employee_id=$2",
        [ids.client, clientEmployee],
      );
    }
  });

  it("CP-02 detects an incident amendment even when updated_at was not maintained", async () => {
    const staged = await stage(7);
    await pool.query(
      "update incident_reports set narrative='Synthetic amended private sentinel' where id=$1",
      [ids.incident],
    );
    try {
      await expect(
        repository.publish(scope, request(staged), audit),
      ).rejects.toThrow(/source|review|changed/i);
      expect(JSON.stringify(staged.reviewedSnapshot)).not.toContain(
        "Synthetic amended private sentinel",
      );
    } finally {
      await pool.query(
        "update incident_reports set narrative='Isolated incident narrative that must not enter the client snapshot.' where id=$1",
        [ids.incident],
      );
    }
  });

  it("retries only aborted transactions and commits one publication/audit", async () => {
    const staged = await stage(8);
    await pool.query("create sequence nx812a_retry_count");
    await pool.query(
      `create function nx812a_aborted_transaction() returns trigger language plpgsql as $$ begin if nextval('nx812a_retry_count') < 3 then raise exception 'controlled serialization abort' using errcode='40001'; end if; return new; end $$`,
    );
    await pool.query(
      `create trigger nx812a_aborted_transaction before insert on client_report_publications for each row when (new.draft_id='${staged.id}') execute function nx812a_aborted_transaction()`,
    );
    try {
      const published = await repository.publish(scope, request(staged), audit);
      expect(
        (await pool.query("select last_value::int from nx812a_retry_count"))
          .rows[0].last_value,
      ).toBe(3);
      expect(
        (
          await pool.query(
            "select id from client_report_publications where draft_id=$1",
            [staged.id],
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await pool.query(
            "select id from audit_events where entity_id=$1 and action='client-report.published'",
            [published.id],
          )
        ).rows,
      ).toHaveLength(1);
    } finally {
      await pool.query(
        "drop trigger nx812a_aborted_transaction on client_report_publications",
      );
      await pool.query("drop function nx812a_aborted_transaction()");
      await pool.query("drop sequence nx812a_retry_count");
    }
  });

  it("CP-05 preserves direct historical access beyond the bounded 25-publication list", async () => {
    const staged = await stage(12);
    const original = await repository.publish(scope, request(staged), audit);
    for (let version = 1; version < 27; version++) {
      await repository.publish(
        scope,
        { ...request(staged), expectedVersion: version },
        audit,
      );
    }
    const listed = await repository.listPublished(scope);
    expect(listed).toHaveLength(25);
    expect(listed.some((row) => row.id === original.id)).toBe(false);
    expect(
      await (await clientService()).publication(original.id),
    ).toMatchObject({
      id: original.id,
      version: 1,
      isCurrent: false,
    });
    expect(
      await repository.publication(
        { ...scope, organizationId: randomUUID() },
        original.id,
      ),
    ).toBeNull();
  });

  it("CP-06 records cross-tenant/cross-draft DB defense gaps without persisting invalid rows", async () => {
    const connection = await pool.connect();
    await connection.query("begin");
    try {
      const organization = randomUUID(),
        foreignDraft = randomUUID();
      await connection.query(
        "insert into organizations(id,name,status) values($1,'Synthetic defense-gap organization','active')",
        [organization],
      );
      const insertedDraft = await connection.query(
        "insert into client_report_drafts(id,organization_id,client_id,scope_key,site_ids,period_start,period_end,created_by_user_id,updated_by_user_id) values($1,$2,$3,$4,$5,'2026-09-01','2026-09-02',$6,$6) returning id",
        [
          foreignDraft,
          organization,
          ids.client,
          randomUUID(),
          JSON.stringify([ids.site]),
          ids.actor,
        ],
      );
      expect(insertedDraft.rows).toHaveLength(1);
      const prior = (
        await connection.query(
          "select id from client_report_publications where draft_id=$1 order by version limit 1",
          [draft.id],
        )
      ).rows[0].id;
      const inserted = await connection.query(
        "insert into client_report_publications(draft_id,organization_id,client_id,site_ids,period_start,period_end,version,supersedes_id,confirmation_key,snapshot,published_by_user_id) values($1,$2,$3,$4,'2026-09-01','2026-09-02',4,$5,$6,'{}',$7) returning id",
        [
          foreignDraft,
          organization,
          ids.client,
          JSON.stringify([ids.site]),
          prior,
          randomUUID(),
          ids.actor,
        ],
      );
      expect(inserted.rows).toHaveLength(1);
      // Acceptance here documents absent DB constraints, not application success.
      // No public repository operation accepts these supplied ownership fields.
    } finally {
      await connection.query("rollback");
      connection.release();
    }
  });

  it("legacy publications remain readable but unknown confirmation identities fail closed", async () => {
    const staged = await stage(9);
    const key = randomUUID();
    const legacy = (
      await pool.query(
        "insert into client_report_publications(draft_id,organization_id,client_id,site_ids,period_start,period_end,version,confirmation_key,snapshot,published_by_user_id) values($1,$2,$3,$4,$5,$6,1,$7,$8,$9) returning id",
        [
          staged.id,
          ids.organization,
          ids.client,
          JSON.stringify(staged.siteIds),
          staged.periodStart,
          staged.periodEnd,
          key,
          JSON.stringify(staged.reviewedSnapshot),
          ids.actor,
        ],
      )
    ).rows[0];
    expect(await repository.publication(scope, legacy.id)).toMatchObject({
      id: legacy.id,
      version: 1,
    });
    await expect(
      repository.publish(
        scope,
        { ...request(staged), confirmationKey: key },
        audit,
      ),
    ).rejects.toThrow(/confirmation|review/i);
    expect(
      (
        await pool.query(
          "select id from client_report_publications where draft_id=$1",
          [staged.id],
        )
      ).rows,
    ).toHaveLength(1);
  });

  it("bounds repeated serialization aborts without publication or audit", async () => {
    const staged = await stage(10);
    await pool.query("create sequence nx812a_retry_limit_count");
    await pool.query(
      `create function nx812a_always_abort() returns trigger language plpgsql as $$ begin perform nextval('nx812a_retry_limit_count'); raise exception 'controlled repeated abort' using errcode='40001'; end $$`,
    );
    await pool.query(
      `create trigger nx812a_always_abort before insert on client_report_publications for each row when (new.draft_id='${staged.id}') execute function nx812a_always_abort()`,
    );
    try {
      await expect(
        repository.publish(scope, request(staged), audit),
      ).rejects.toThrow();
      expect(
        (
          await pool.query(
            "select last_value::int from nx812a_retry_limit_count",
          )
        ).rows[0].last_value,
      ).toBe(3);
      expect(
        (
          await pool.query(
            "select id from client_report_publications where draft_id=$1",
            [staged.id],
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await pool.query(
        "drop trigger nx812a_always_abort on client_report_publications",
      );
      await pool.query("drop function nx812a_always_abort()");
      await pool.query("drop sequence nx812a_retry_limit_count");
    }
  });
});
