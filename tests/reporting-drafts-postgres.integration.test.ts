import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "@/server/db/schema";
import {
  activityEntries,
  auditEvents,
  endOfShiftReports,
  incidentParticipants,
  incidentReports,
  reportingDrafts,
  shiftAssignments,
} from "@/server/db/schema";
import { PostgresReportingDraftRepository } from "@/features/reporting-drafts/postgres-repository";
import { PostgresReportingRepository } from "@/features/reporting/postgres-repository";
import { PostgresEndOfShiftReportRepository } from "@/features/eosr/postgres-repository";
import type {
  DraftFamily,
  DraftFinalization,
} from "@/features/reporting-drafts/contracts";
import { ReportingDraftService } from "@/features/reporting-drafts/service";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";

const suite =
  process.env.NEXUS_POSTGRES_TEST === "true"
    ? describe.sequential
    : describe.skip;
const ids = {
  org: "00000000-0000-4000-8000-000000000001",
  user: "00000000-0000-4000-8000-000000000050",
  employee: "00000000-0000-4000-8000-000000000060",
  assignment: "00000000-0000-4000-8000-000000000090",
  oldAssignment: "00000000-0000-4000-8000-000000000097",
  incomingUser: "00000000-0000-4000-8000-000000000051",
  incomingEmployee: "00000000-0000-4000-8000-000000000061",
  incomingAssignment: "00000000-0000-4000-8000-000000000094",
};
const scope = {
  organizationId: ids.org,
  organizationWide: true,
  branchIds: [] as string[],
  clientIds: [] as string[],
  siteIds: [] as string[],
};
const audit = {
  organizationId: ids.org,
  actorUserId: ids.user,
  requestId: "nx87-postgres",
};
const nextKey = () => `nx87-${crypto.randomUUID()}`;

suite("NX-8.7 durable reporting drafts in PostgreSQL", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let drafts: PostgresReportingDraftRepository;
  let reporting: PostgresReportingRepository;
  let eosr: PostgresEndOfShiftReportRepository;
  const createdActivityIds: string[] = [];
  const createdIncidentIds: string[] = [];
  const createdEosrIds: string[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
    db = drizzle(pool, { schema });
    drafts = new PostgresReportingDraftRepository(db);
    reporting = new PostgresReportingRepository(db);
    eosr = new PostgresEndOfShiftReportRepository(db);
    await db
      .delete(reportingDrafts)
      .where(
        and(
          eq(reportingDrafts.organizationId, ids.org),
          inArray(reportingDrafts.ownerUserId, [ids.user, ids.incomingUser]),
          inArray(reportingDrafts.shiftAssignmentId, [
            ids.assignment,
            ids.oldAssignment,
            ids.incomingAssignment,
          ]),
        ),
      );
  });

  afterAll(async () => {
    if (!db || !pool) return;
    await db
      .delete(reportingDrafts)
      .where(
        and(
          eq(reportingDrafts.organizationId, ids.org),
          inArray(reportingDrafts.ownerUserId, [ids.user, ids.incomingUser]),
          inArray(reportingDrafts.shiftAssignmentId, [
            ids.assignment,
            ids.oldAssignment,
            ids.incomingAssignment,
          ]),
        ),
      );
    if (createdIncidentIds.length) {
      await db
        .delete(incidentParticipants)
        .where(
          inArray(incidentParticipants.incidentReportId, createdIncidentIds),
        );
      await db
        .delete(incidentReports)
        .where(inArray(incidentReports.id, createdIncidentIds));
    }
    if (createdActivityIds.length)
      await db
        .delete(activityEntries)
        .where(inArray(activityEntries.id, createdActivityIds));
    if (createdEosrIds.length)
      await db
        .delete(endOfShiftReports)
        .where(inArray(endOfShiftReports.id, createdEosrIds));
    await db
      .delete(auditEvents)
      .where(eq(auditEvents.requestId, audit.requestId));
    await pool.end();
  });

  async function save(
    family: DraftFamily,
    assignmentId = ids.assignment,
    ownerUserId = ids.user,
    ownerEmployeeId = ids.employee,
    payload: Record<string, unknown> = { narrative: "Working note" },
  ) {
    const clientDraftKey = nextKey();
    const submissionKey = nextKey();
    const saveKey = nextKey();
    const row = await drafts.save(
      {
        organizationId: ids.org,
        ownerUserId,
        ownerEmployeeId,
        assignmentId,
        family,
        clientDraftKey,
        submissionKey,
        saveKey,
        expectedRevision: 0,
        payload,
      },
      { ...audit, actorUserId: ownerUserId },
    );
    return { row, clientDraftKey, submissionKey, saveKey };
  }

  function finalization(
    row: Awaited<ReturnType<typeof drafts.save>>,
    ownerUserId = ids.user,
    ownerEmployeeId = ids.employee,
  ): DraftFinalization {
    return {
      id: row.id,
      organizationId: ids.org,
      ownerUserId,
      ownerEmployeeId,
      shiftAssignmentId: row.shiftAssignmentId,
      family: row.family,
      revision: row.revision,
      submissionKey: row.submissionKey,
    };
  }

  async function service(
    role:
      | "GUARD"
      | "SUPERVISOR"
      | "OPERATIONS_MANAGER"
      | "ADMIN"
      | "CLIENT_USER"
      | "LEADERSHIP",
    userId: string,
    employeeId?: string,
    organizationId = ids.org,
  ) {
    const request = await createAuthenticatedRequestContext(
      {
        resolve: async () => ({
          principal: {
            userId,
            organizationId,
            roles: [role],
            employeeId,
            organizationWide: true,
            branchIds: [],
            clientIds: [],
            siteIds: [],
          },
        }),
      },
      "nx87-postgres",
    );
    return new ReportingDraftService(
      new AuthorizedDataAccess(request),
      reporting,
      drafts,
    );
  }

  it("denies other roles/users and enforces the 64 KiB payload bound", async () => {
    const guard = await service("GUARD", ids.user, ids.employee);
    const saved = await guard.save({
      shiftAssignmentId: ids.assignment,
      family: "SECURITY_INCIDENT",
      clientDraftKey: nextKey(),
      submissionKey: nextKey(),
      saveKey: nextKey(),
      expectedRevision: 0,
      payload: { narrative: "Private NX87 participant note", participants: [] },
    });
    expect((await guard.get(ids.assignment, "SECURITY_INCIDENT"))?.id).toBe(
      saved.id,
    );
    await expect(
      db
        .update(reportingDrafts)
        .set({ clientDraftKey: null })
        .where(eq(reportingDrafts.id, saved.id)),
    ).rejects.toThrow();
    for (const role of [
      "SUPERVISOR",
      "OPERATIONS_MANAGER",
      "ADMIN",
      "CLIENT_USER",
      "LEADERSHIP",
    ] as const) {
      const other = await service(role, ids.incomingUser, ids.incomingEmployee);
      await expect(
        other.get(ids.assignment, "SECURITY_INCIDENT"),
      ).rejects.toThrow();
    }
    const wrongTenant = await service(
      "GUARD",
      ids.user,
      ids.employee,
      "00000000-0000-4000-8000-000000000999",
    );
    await expect(
      wrongTenant.get(ids.assignment, "SECURITY_INCIDENT"),
    ).rejects.toThrow();
    await expect(
      guard.save({
        shiftAssignmentId: ids.assignment,
        family: "SECURITY_INCIDENT",
        clientDraftKey: saved.clientDraftKey,
        submissionKey: saved.submissionKey,
        saveKey: nextKey(),
        expectedRevision: saved.revision,
        payload: { narrative: "x".repeat(65537), participants: [] },
      }),
    ).rejects.toThrow();
    await expect(
      guard.save({
        shiftAssignmentId: ids.assignment,
        family: "SECURITY_INCIDENT",
        clientDraftKey: saved.clientDraftKey,
        submissionKey: saved.submissionKey,
        saveKey: nextKey(),
        expectedRevision: saved.revision,
        payload: JSON.parse('{"__proto__":{"isAdmin":true},"participants":[]}'),
      }),
    ).rejects.toThrow();
    await expect(
      guard.save({
        shiftAssignmentId: ids.assignment,
        family: "SECURITY_INCIDENT",
        clientDraftKey: saved.clientDraftKey,
        submissionKey: saved.submissionKey,
        saveKey: nextKey(),
        expectedRevision: saved.revision,
        payload: {
          participants: [
            { type: "SUBJECT", attachmentUrl: "https://example.invalid/file" },
          ],
        },
      }),
    ).rejects.toThrow();
    await expect(
      db
        .update(reportingDrafts)
        .set({ payload: { narrative: "x".repeat(65537) } })
        .where(eq(reportingDrafts.id, saved.id)),
    ).rejects.toThrow();
    await guard.discard(ids.assignment, saved.id, saved.revision);
    const draftAudit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.entityId, saved.id));
    expect(draftAudit).toHaveLength(2);
    expect(JSON.stringify(draftAudit)).not.toContain(
      "Private NX87 participant note",
    );
  });

  it("enforces one active owner/family, replay-safe saves, revision conflicts, and containment", async () => {
    const { row, clientDraftKey, submissionKey, saveKey } =
      await save("SHIFT_ACTIVITY");
    expect(row.revision).toBe(1);
    expect(
      await drafts.get(
        ids.org,
        ids.user,
        ids.employee,
        ids.assignment,
        "SHIFT_ACTIVITY",
      ),
    ).toMatchObject({ id: row.id });
    expect(
      await drafts.get(
        ids.org,
        ids.incomingUser,
        ids.incomingEmployee,
        ids.assignment,
        "SHIFT_ACTIVITY",
      ),
    ).toBeNull();
    expect(
      await drafts.get(
        "00000000-0000-4000-8000-000000000999",
        ids.user,
        ids.employee,
        ids.assignment,
        "SHIFT_ACTIVITY",
      ),
    ).toBeNull();
    await expect(
      drafts.save(
        {
          organizationId: ids.org,
          ownerUserId: ids.user,
          ownerEmployeeId: ids.employee,
          assignmentId: ids.assignment,
          family: "SHIFT_ACTIVITY",
          clientDraftKey: nextKey(),
          submissionKey: nextKey(),
          saveKey: nextKey(),
          expectedRevision: 0,
          payload: { narrative: "Other tab" },
        },
        audit,
      ),
    ).rejects.toThrow();
    const replay = await drafts.save(
      {
        organizationId: ids.org,
        ownerUserId: ids.user,
        ownerEmployeeId: ids.employee,
        assignmentId: ids.assignment,
        family: "SHIFT_ACTIVITY",
        clientDraftKey,
        submissionKey,
        saveKey,
        expectedRevision: 0,
        payload: { narrative: "Working note" },
      },
      audit,
    );
    expect(replay.id).toBe(row.id);
    await expect(
      drafts.save(
        {
          organizationId: ids.org,
          ownerUserId: ids.user,
          ownerEmployeeId: ids.employee,
          assignmentId: ids.assignment,
          family: "SHIFT_ACTIVITY",
          clientDraftKey,
          submissionKey,
          saveKey,
          expectedRevision: 0,
          payload: { narrative: "Changed replay" },
        },
        audit,
      ),
    ).rejects.toThrow();
    const updated = await drafts.save(
      {
        organizationId: ids.org,
        ownerUserId: ids.user,
        ownerEmployeeId: ids.employee,
        assignmentId: ids.assignment,
        family: "SHIFT_ACTIVITY",
        clientDraftKey,
        submissionKey,
        saveKey: nextKey(),
        expectedRevision: 1,
        payload: { narrative: "Updated" },
      },
      audit,
    );
    expect(updated.revision).toBe(2);
    await expect(
      drafts.save(
        {
          organizationId: ids.org,
          ownerUserId: ids.user,
          ownerEmployeeId: ids.employee,
          assignmentId: ids.assignment,
          family: "SHIFT_ACTIVITY",
          clientDraftKey,
          submissionKey,
          saveKey: nextKey(),
          expectedRevision: 1,
          payload: { narrative: "Stale tab" },
        },
        audit,
      ),
    ).rejects.toThrow();
    await drafts.discard(
      ids.org,
      ids.user,
      ids.employee,
      ids.assignment,
      row.id,
      2,
      audit,
    );
    expect(
      await drafts.get(
        ids.org,
        ids.user,
        ids.employee,
        ids.assignment,
        "SHIFT_ACTIVITY",
      ),
    ).toBeNull();
    const retired = await db
      .select()
      .from(reportingDrafts)
      .where(eq(reportingDrafts.id, row.id));
    expect(retired[0]).toMatchObject({
      payload: {},
      disposition: "DISCARDED",
      clientDraftKey: null,
      submissionKey: null,
      lastSaveKey: null,
    });
  });

  it("fails closed after assignment cancellation or reassignment without transferring ownership", async () => {
    const { row } = await save("SHIFT_ACTIVITY");
    const guard = await service("GUARD", ids.user, ids.employee);
    const original = await db
      .select({
        status: shiftAssignments.status,
        employeeId: shiftAssignments.employeeId,
      })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.id, ids.assignment));
    try {
      await db
        .update(shiftAssignments)
        .set({ status: "cancelled" })
        .where(eq(shiftAssignments.id, ids.assignment));
      await expect(
        guard.get(ids.assignment, "SHIFT_ACTIVITY"),
      ).rejects.toThrow();
      await expect(
        guard.draftForSubmission(ids.assignment, row.id),
      ).rejects.toThrow();
      await db
        .update(shiftAssignments)
        .set({ status: original[0]!.status, employeeId: ids.incomingEmployee })
        .where(eq(shiftAssignments.id, ids.assignment));
      await expect(
        guard.get(ids.assignment, "SHIFT_ACTIVITY"),
      ).rejects.toThrow();
      const incoming = await service(
        "GUARD",
        ids.incomingUser,
        ids.incomingEmployee,
      );
      expect(await incoming.get(ids.assignment, "SHIFT_ACTIVITY")).toBeNull();
    } finally {
      await db
        .update(shiftAssignments)
        .set({
          status: original[0]!.status,
          employeeId: original[0]!.employeeId,
        })
        .where(eq(shiftAssignments.id, ids.assignment));
      await drafts.discard(
        ids.org,
        ids.user,
        ids.employee,
        ids.assignment,
        row.id,
        row.revision,
        audit,
      );
    }
  });

  it("atomically submits one ActivityEntry and retires its payload", async () => {
    const context = await reporting.getActivityContext(scope, ids.assignment);
    expect(context).not.toBeNull();
    const { row } = await save(
      "SHIFT_ACTIVITY",
      ids.assignment,
      ids.user,
      ids.employee,
      { category: "OBSERVATION", narrative: "North lobby note" },
    );
    const entry = await reporting.createActivity(
      scope,
      context!,
      {
        category: "OBSERVATION",
        occurredAt: new Date().toISOString(),
        narrative: "North lobby note",
        followUpRequired: false,
        visibility: "INTERNAL",
        submissionKey: row.submissionKey,
      },
      audit,
      finalization(row),
    );
    createdActivityIds.push(entry.id);
    expect(
      (
        await db
          .select()
          .from(reportingDrafts)
          .where(eq(reportingDrafts.id, row.id))
      )[0],
    ).toMatchObject({
      payload: {},
      disposition: "SUBMITTED",
      canonicalRecordId: entry.id,
      clientDraftKey: null,
      submissionKey: null,
      lastSaveKey: null,
    });
    await expect(
      reporting.createActivity(
        scope,
        context!,
        {
          category: "OBSERVATION",
          occurredAt: new Date().toISOString(),
          narrative: "Duplicate",
          followUpRequired: false,
          visibility: "INTERNAL",
          submissionKey: row.submissionKey,
        },
        audit,
        finalization(row),
      ),
    ).rejects.toThrow();
    const canonical = await db
      .select()
      .from(activityEntries)
      .where(
        and(
          eq(activityEntries.shiftAssignmentId, ids.assignment),
          eq(activityEntries.submissionKey, row.submissionKey),
        ),
      );
    expect(canonical).toHaveLength(1);
  });

  it("rejects stale two-tab writes and resolves a save/submission race without duplicate activity", async () => {
    const context = await reporting.getActivityContext(scope, ids.assignment);
    const { row, clientDraftKey, submissionKey } = await save(
      "SHIFT_ACTIVITY",
      ids.assignment,
      ids.user,
      ids.employee,
      { category: "OBSERVATION", narrative: "Initial" },
    );
    const competing = await Promise.allSettled(
      ["Tab A", "Tab B"].map((narrative) =>
        drafts.save(
          {
            organizationId: ids.org,
            ownerUserId: ids.user,
            ownerEmployeeId: ids.employee,
            assignmentId: ids.assignment,
            family: "SHIFT_ACTIVITY",
            clientDraftKey,
            submissionKey,
            saveKey: nextKey(),
            expectedRevision: 1,
            payload: { category: "OBSERVATION", narrative },
          },
          audit,
        ),
      ),
    );
    expect(
      competing.filter((item) => item.status === "fulfilled"),
    ).toHaveLength(1);
    expect(competing.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
    const current = (
      await db
        .select()
        .from(reportingDrafts)
        .where(eq(reportingDrafts.id, row.id))
    )[0]!;
    expect(current.revision).toBe(2);
    const race = await Promise.allSettled([
      reporting.createActivity(
        scope,
        context!,
        {
          category: "OBSERVATION",
          occurredAt: new Date().toISOString(),
          narrative: (current.payload as { narrative: string }).narrative,
          followUpRequired: false,
          visibility: "INTERNAL",
          submissionKey,
        },
        audit,
        { ...finalization(row), revision: 2 },
      ),
      drafts.save(
        {
          organizationId: ids.org,
          ownerUserId: ids.user,
          ownerEmployeeId: ids.employee,
          assignmentId: ids.assignment,
          family: "SHIFT_ACTIVITY",
          clientDraftKey,
          submissionKey,
          saveKey: nextKey(),
          expectedRevision: 2,
          payload: { category: "OBSERVATION", narrative: "Latest edit" },
        },
        audit,
      ),
    ]);
    expect(race.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const canonical = await db
      .select()
      .from(activityEntries)
      .where(eq(activityEntries.submissionKey, submissionKey));
    if (canonical[0]) {
      createdActivityIds.push(canonical[0].id);
      expect(
        (
          await db
            .select()
            .from(reportingDrafts)
            .where(eq(reportingDrafts.id, row.id))
        )[0],
      ).toMatchObject({ disposition: "SUBMITTED", payload: {} });
    } else {
      const fresh = (
        await db
          .select()
          .from(reportingDrafts)
          .where(eq(reportingDrafts.id, row.id))
      )[0]!;
      expect(fresh.revision).toBe(3);
      const result = await reporting.createActivity(
        scope,
        context!,
        {
          category: "OBSERVATION",
          occurredAt: new Date().toISOString(),
          narrative: "Latest edit",
          followUpRequired: false,
          visibility: "INTERNAL",
          submissionKey,
        },
        audit,
        { ...finalization(row), revision: 3 },
      );
      createdActivityIds.push(result.id);
    }
    expect(
      await db
        .select()
        .from(activityEntries)
        .where(eq(activityEntries.submissionKey, submissionKey)),
    ).toHaveLength(1);
  });

  it("rolls back an Incident and draft retirement when participant insertion fails", async () => {
    const context = await reporting.getActivityContext(scope, ids.assignment);
    const { row } = await save(
      "SECURITY_INCIDENT",
      ids.assignment,
      ids.user,
      ids.employee,
      { narrative: "Door incident", participants: [] },
    );
    const base = {
      classification: "SECURITY" as const,
      severity: "HIGH" as const,
      occurredAt: new Date().toISOString(),
      narrative: "Door incident",
      actionsTaken: "Entry denied",
      emergencyServiceInvolvement: false,
      visibility: "INTERNAL" as const,
      submissionKey: row.submissionKey,
    };
    await expect(
      reporting.createIncident(
        scope,
        context!,
        {
          ...base,
          participants: [
            {
              type: null as unknown as "SUBJECT",
              involvementSummary: "Invalid",
            },
          ],
        },
        audit,
        finalization(row),
      ),
    ).rejects.toThrow();
    expect(
      await db
        .select()
        .from(incidentReports)
        .where(eq(incidentReports.submissionKey, row.submissionKey)),
    ).toHaveLength(0);
    expect(
      (
        await db
          .select()
          .from(reportingDrafts)
          .where(eq(reportingDrafts.id, row.id))
      )[0],
    ).toMatchObject({
      disposition: "ACTIVE",
      payload: { narrative: "Door incident", participants: [] },
    });
    const incident = await reporting.createIncident(
      scope,
      context!,
      {
        ...base,
        participants: [
          {
            type: "SUBJECT",
            identityState: "UNIDENTIFIED",
            descriptiveIdentifier: "Unknown person",
            involvementSummary: "Attempted entry",
          },
        ],
      },
      audit,
      finalization(row),
    );
    createdIncidentIds.push(incident.id);
    expect(
      await db
        .select()
        .from(incidentParticipants)
        .where(eq(incidentParticipants.incidentReportId, incident.id)),
    ).toHaveLength(1);
    expect(
      (
        await db
          .select()
          .from(reportingDrafts)
          .where(eq(reportingDrafts.id, row.id))
      )[0],
    ).toMatchObject({
      disposition: "SUBMITTED",
      payload: {},
      canonicalRecordId: incident.id,
    });
  });

  it("preserves one EOSR per assignment and retires the closeout draft", async () => {
    const context = await eosr.getAssignment(scope, ids.oldAssignment);
    expect(context).not.toBeNull();
    const { row } = await save(
      "SHIFT_CLOSEOUT",
      ids.oldAssignment,
      ids.user,
      ids.employee,
      { summary: "Shift complete" },
    );
    const report = await eosr.create(
      scope,
      context!,
      {
        shiftAssignmentId: ids.oldAssignment,
        submittedByUserId: ids.user,
        summary: "Shift complete",
        unresolvedIssues: [],
        equipmentAccessStatus: "",
        followUpItems: [],
        unusualConditions: "",
        submissionKey: row.submissionKey,
      },
      audit,
      finalization(row),
    );
    createdEosrIds.push(report.id);
    expect(
      (
        await db
          .select()
          .from(reportingDrafts)
          .where(eq(reportingDrafts.id, row.id))
      )[0],
    ).toMatchObject({ disposition: "SUBMITTED", payload: {} });
    expect(
      await db
        .select()
        .from(endOfShiftReports)
        .where(eq(endOfShiftReports.shiftAssignmentId, ids.oldAssignment)),
    ).toHaveLength(1);
  });

  it("expires only elapsed active drafts in a bounded batch", async () => {
    const { row } = await save(
      "SHIFT_CLOSEOUT",
      ids.incomingAssignment,
      ids.incomingUser,
      ids.incomingEmployee,
    );
    await db
      .update(reportingDrafts)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(reportingDrafts.id, row.id));
    expect(await drafts.expireBatch(1)).toBe(1);
    expect(await drafts.expireBatch(1)).toBe(0);
    expect(
      (
        await db
          .select()
          .from(reportingDrafts)
          .where(eq(reportingDrafts.id, row.id))
      )[0],
    ).toMatchObject({
      disposition: "EXPIRED",
      payload: {},
      clientDraftKey: null,
      submissionKey: null,
      lastSaveKey: null,
    });
  });
});
