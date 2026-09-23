import { existsSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresReportingExceptionRepository } from "@/features/reporting-exceptions/postgres-repository";
import {
  activityEntries,
  auditEvents,
  clockEvents,
  endOfShiftReports,
  reportingExceptionEvents,
  reportingExceptions,
  shiftAssignments,
  shifts,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";

const suite =
  process.env.NEXUS_POSTGRES_TEST === "true"
    ? describe.sequential
    : describe.skip;
const ids = {
  organization: "00000000-0000-4000-8000-000000000001",
  post: "00000000-0000-4000-8000-000000000040",
  user: "00000000-0000-4000-8000-000000000050",
  employee: "00000000-0000-4000-8000-000000000060",
  shift: "00000000-0000-4000-8000-000000008501",
  assignment: "00000000-0000-4000-8000-000000008502",
  clockIn: "00000000-0000-4000-8000-000000008503",
  clockOut: "00000000-0000-4000-8000-000000008504",
  activity: "00000000-0000-4000-8000-000000008505",
  eosr: "00000000-0000-4000-8000-000000008506",
} as const;
const scope = {
  organizationId: ids.organization,
  organizationWide: true,
  branchIds: [] as string[],
  clientIds: [] as string[],
  siteIds: [] as string[],
};
const audit = {
  actorUserId: ids.user,
  organizationId: ids.organization,
  requestId: "nx85-postgres",
};

suite("NX-8.5 PostgreSQL reporting-exception integrity", () => {
  let pool: Pool;
  let database: ReturnType<typeof drizzle<typeof schema>>;
  let repository: PostgresReportingExceptionRepository;
  const clockOut = new Date("2026-09-22T19:30:00.000Z");

  async function clear() {
    await database
      .delete(auditEvents)
      .where(eq(auditEvents.entityType, "ReportingException"));
    await database
      .delete(reportingExceptionEvents)
      .where(
        sql`${reportingExceptionEvents.reportingExceptionId} in (select id from reporting_exceptions where shift_assignment_id = ${ids.assignment})`,
      );
    await database
      .delete(reportingExceptions)
      .where(eq(reportingExceptions.shiftAssignmentId, ids.assignment));
    await database
      .delete(endOfShiftReports)
      .where(eq(endOfShiftReports.id, ids.eosr));
    await database
      .delete(activityEntries)
      .where(eq(activityEntries.id, ids.activity));
    await database
      .delete(clockEvents)
      .where(eq(clockEvents.shiftAssignmentId, ids.assignment));
    await database
      .delete(shiftAssignments)
      .where(eq(shiftAssignments.id, ids.assignment));
    await database.delete(shifts).where(eq(shifts.id, ids.shift));
  }

  async function fixture(worked = true) {
    await clear();
    await database.insert(shifts).values({
      id: ids.shift,
      postId: ids.post,
      scheduledStart: new Date("2026-09-22T12:00:00.000Z"),
      scheduledEnd: new Date("2026-09-22T20:00:00.000Z"),
      timezone: "America/Los_Angeles",
      status: "COMPLETED",
    });
    await database.insert(shiftAssignments).values({
      id: ids.assignment,
      shiftId: ids.shift,
      employeeId: ids.employee,
      status: "confirmed",
      assignedAt: new Date("2026-09-21T00:00:00.000Z"),
    });
    if (worked)
      await database.insert(clockEvents).values([
        {
          id: ids.clockIn,
          shiftAssignmentId: ids.assignment,
          eventType: "CLOCK_IN",
          occurredAt: new Date("2026-09-22T12:00:00.000Z"),
          effectiveAt: new Date("2026-09-22T12:00:00.000Z"),
          recordedByUserId: ids.user,
          verificationStatus: "NORMAL",
        },
        {
          id: ids.clockOut,
          shiftAssignmentId: ids.assignment,
          eventType: "CLOCK_OUT",
          occurredAt: clockOut,
          effectiveAt: clockOut,
          recordedByUserId: ids.user,
          verificationStatus: "NORMAL",
        },
      ]);
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL && existsSync(".env.local"))
      process.loadEnvFile(".env.local");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    database = drizzle(pool, { schema });
    repository = new PostgresReportingExceptionRepository(database);
  });
  afterAll(async () => {
    if (database) await clear();
    if (pool) await pool.end();
  });

  it("materializes unique worked-assignment obligations under concurrent reconciliation", async () => {
    await fixture();
    await database.insert(activityEntries).values({
      id: ids.activity,
      shiftAssignmentId: ids.assignment,
      occurredAt: new Date("2026-09-22T18:00:00.000Z"),
      category: "REPORTABLE_INCIDENT",
      description: { narrative: "Reportable event" },
      followUpRequired: true,
      incidentRelated: true,
      incidentGate: "REQUIRED",
      visibility: "INTERNAL",
      status: "SUBMITTED",
      submissionKey: "nx85-activity",
    });
    await Promise.all([
      repository.reconcile(scope, "2026-09-22T22:00:00.000Z"),
      repository.reconcile(scope, "2026-09-22T22:00:00.000Z"),
    ]);
    const rows = await database
      .select()
      .from(reportingExceptions)
      .where(eq(reportingExceptions.shiftAssignmentId, ids.assignment));
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.obligationKey)).size).toBe(3);
    expect(
      rows.every(
        (row) =>
          row.effectiveShiftEndAt.toISOString() === clockOut.toISOString(),
      ),
    ).toBe(true);
    expect(
      rows
        .find((row) => row.obligationType === "INCIDENT_REPORT")
        ?.dueAt.toISOString(),
    ).toBe(clockOut.toISOString());
    const events = await database
      .select()
      .from(reportingExceptionEvents)
      .where(
        inArray(
          reportingExceptionEvents.reportingExceptionId,
          rows.map((row) => row.id),
        ),
      );
    expect(events).toHaveLength(3);
  });

  it("creates no exception for a scheduled but unworked assignment", async () => {
    await fixture(false);
    await repository.reconcile(scope, "2026-09-23T00:00:00.000Z");
    expect(
      await database
        .select()
        .from(reportingExceptions)
        .where(eq(reportingExceptions.shiftAssignmentId, ids.assignment)),
    ).toEqual([]);
  });

  it("records delayed correction without erasing missing history", async () => {
    await fixture();
    await repository.reconcile(scope, "2026-09-22T22:00:00.001Z");
    const [before] = await database
      .select()
      .from(reportingExceptions)
      .where(
        and(
          eq(reportingExceptions.shiftAssignmentId, ids.assignment),
          eq(reportingExceptions.obligationType, "EOSR"),
        ),
      );
    expect(before?.classification).toBe("MISSING");
    await database.insert(endOfShiftReports).values({
      id: ids.eosr,
      shiftAssignmentId: ids.assignment,
      submittedByUserId: ids.user,
      summary: "Delayed closeout",
      unresolvedIssues: [],
      equipmentAccessStatus: "",
      followUpItems: [],
      unusualConditions: "",
      submissionKey: "nx85-eosr",
      submittedAt: new Date("2026-09-22T22:10:00.000Z"),
    });
    await repository.reconcile(scope, "2026-09-22T22:11:00.000Z");
    const detail = await repository.detail(scope, before!.id);
    expect(detail?.exception).toMatchObject({
      state: "CORRECTED_PENDING_REVIEW",
      classification: "MISSING",
    });
    expect(detail?.history.map((event) => event.nextState)).toEqual([
      "OPEN",
      "CORRECTED_PENDING_REVIEW",
    ]);
  });

  it("rejects stale updates and rolls back state when event insertion fails", async () => {
    await fixture();
    await repository.reconcile(scope, "2026-09-22T20:30:00.000Z");
    const [record] = await database
      .select()
      .from(reportingExceptions)
      .where(eq(reportingExceptions.shiftAssignmentId, ids.assignment));
    await expect(
      repository.transition(
        scope,
        {
          exceptionId: record!.id,
          nextState: "ACKNOWLEDGED",
          reason: "Stale",
          expectedRevision: 99,
        },
        audit,
      ),
    ).rejects.toThrow(/changed/i);
    await pool.query(
      "create or replace function nx85_fail_event() returns trigger language plpgsql as $$ begin if new.reason = 'FORCE_ROLLBACK' then raise exception 'forced'; end if; return new; end $$",
    );
    await pool.query(
      "create trigger nx85_fail_event before insert on reporting_exception_events for each row execute function nx85_fail_event()",
    );
    try {
      await expect(
        repository.transition(
          scope,
          {
            exceptionId: record!.id,
            nextState: "ACKNOWLEDGED",
            reason: "FORCE_ROLLBACK",
            expectedRevision: 0,
          },
          audit,
        ),
      ).rejects.toThrow(/Failed query/i);
    } finally {
      await pool.query(
        "drop trigger if exists nx85_fail_event on reporting_exception_events",
      );
      await pool.query("drop function if exists nx85_fail_event()");
    }
    const detail = await repository.detail(scope, record!.id);
    expect(detail?.exception).toMatchObject({ state: "OPEN", revision: 0 });
    expect(detail?.history).toHaveLength(1);
  });

  it("fails closed for tenant and site scopes", async () => {
    await fixture();
    await repository.reconcile(scope, "2026-09-22T20:30:00.000Z");
    const [record] = await database
      .select()
      .from(reportingExceptions)
      .where(eq(reportingExceptions.shiftAssignmentId, ids.assignment));
    await expect(
      repository.detail(
        { ...scope, organizationId: "00000000-0000-4000-8000-000000000999" },
        record!.id,
      ),
    ).resolves.toBeNull();
    await expect(
      repository.detail(
        {
          ...scope,
          organizationWide: false,
          siteIds: ["00000000-0000-4000-8000-000000000999"],
        },
        record!.id,
      ),
    ).resolves.toBeNull();
  });
});
