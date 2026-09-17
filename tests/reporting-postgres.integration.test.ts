import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray } from "drizzle-orm";
import { Pool } from "pg";
import { PostgresReportingRepository } from "@/features/reporting/postgres-repository";
import {
  branches,
  auditEvents,
  clients,
  employees,
  incidentParticipants,
  incidentReports,
  organizations,
  posts,
  shiftAssignments,
  shifts,
  sites,
  users,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";

const enabled = process.env.NEXUS_POSTGRES_TEST === "true";
const suite = enabled ? describe.sequential : describe.skip;
const id = (suffix: string) =>
  `83000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const ids = {
  org: id("1"),
  otherOrg: id("2"),
  branch: id("3"),
  otherBranch: id("4"),
  client: id("5"),
  otherClient: id("6"),
  site: id("7"),
  otherSite: id("8"),
  post: id("9"),
  user: id("10"),
  employee: id("11"),
  shift: id("12"),
  assignment: id("13"),
  legacy: id("14"),
  zero: id("15"),
};

suite("NX-8.3 PostgreSQL incident participants", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repo: PostgresReportingRepository;
  const scope = {
    organizationId: ids.org,
    organizationWide: true,
    branchIds: [] as string[],
    clientIds: [] as string[],
    siteIds: [] as string[],
  };
  const context = {
    id: ids.assignment,
    organizationId: ids.org,
    branchId: ids.branch,
    clientId: ids.client,
    siteId: ids.site,
    postId: ids.post,
    employeeId: ids.employee,
    assignmentStatus: "assigned" as const,
    siteName: "NX83 Site",
    postName: "NX83 Post",
    scheduledStart: "2026-09-17T00:00:00.000Z",
    scheduledEnd: "2026-09-18T00:00:00.000Z",
  };
  const audit = {
    actorUserId: ids.user,
    organizationId: ids.org,
    requestId: "nx83-postgres",
  };
  const incident = (key: string) => ({
    classification: "SECURITY" as const,
    severity: "HIGH" as const,
    occurredAt: "2026-09-17T12:00:00.000Z",
    narrative: "Attempted unauthorized entry.",
    actionsTaken: "Entry denied.",
    emergencyServiceInvolvement: false,
    visibility: "INTERNAL" as const,
    submissionKey: key,
    participants: [
      {
        type: "SUBJECT" as const,
        identityState: "UNIDENTIFIED" as const,
        descriptiveIdentifier: "Person near east entrance",
        involvementSummary: "Attempted entry.",
      },
    ],
  });

  beforeAll(async () => {
    if (!process.env.DATABASE_URL && existsSync(".env.local"))
      process.loadEnvFile(".env.local");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
    db = drizzle(pool, { schema });
    repo = new PostgresReportingRepository(db);
    await db.delete(auditEvents).where(eq(auditEvents.organizationId, ids.org));
    const priorIncidentIds = (
      await db
        .select({ id: incidentReports.id })
        .from(incidentReports)
        .where(eq(incidentReports.shiftAssignmentId, ids.assignment))
    ).map((row) => row.id);
    if (priorIncidentIds.length)
      await db
        .delete(incidentParticipants)
        .where(
          inArray(incidentParticipants.incidentReportId, priorIncidentIds),
        );
    await db
      .delete(incidentReports)
      .where(eq(incidentReports.shiftAssignmentId, ids.assignment));
    await db
      .delete(shiftAssignments)
      .where(eq(shiftAssignments.id, ids.assignment));
    await db.delete(shifts).where(eq(shifts.id, ids.shift));
    await db.delete(employees).where(eq(employees.id, ids.employee));
    await db.delete(users).where(eq(users.id, ids.user));
    await db.delete(posts).where(eq(posts.id, ids.post));
    await db.delete(sites).where(inArray(sites.id, [ids.site, ids.otherSite]));
    await db
      .delete(clients)
      .where(inArray(clients.id, [ids.client, ids.otherClient]));
    await db
      .delete(branches)
      .where(inArray(branches.id, [ids.branch, ids.otherBranch]));
    await db
      .delete(organizations)
      .where(inArray(organizations.id, [ids.org, ids.otherOrg]));
    await db.insert(organizations).values([
      { id: ids.org, name: "NX83", status: "active" },
      { id: ids.otherOrg, name: "Other", status: "active" },
    ]);
    await db.insert(branches).values([
      {
        id: ids.branch,
        organizationId: ids.org,
        name: "NX83",
        timezone: "UTC",
        status: "active",
      },
      {
        id: ids.otherBranch,
        organizationId: ids.otherOrg,
        name: "Other",
        timezone: "UTC",
        status: "active",
      },
    ]);
    await db.insert(clients).values([
      {
        id: ids.client,
        organizationId: ids.org,
        branchId: ids.branch,
        name: "NX83",
        status: "active",
      },
      {
        id: ids.otherClient,
        organizationId: ids.otherOrg,
        branchId: ids.otherBranch,
        name: "Other",
        status: "active",
      },
    ]);
    await db.insert(sites).values([
      {
        id: ids.site,
        clientId: ids.client,
        name: "NX83 Site",
        address: {},
        timezone: "UTC",
      },
      {
        id: ids.otherSite,
        clientId: ids.otherClient,
        name: "Other Site",
        address: {},
        timezone: "UTC",
      },
    ]);
    await db.insert(posts).values({
      id: ids.post,
      siteId: ids.site,
      name: "NX83 Post",
      description: "Test",
      serviceType: "site_security",
      armedRequirement: "UNARMED",
    });
    await db.insert(users).values({
      id: ids.user,
      organizationId: ids.org,
      email: "nx83@example.test",
      status: "active",
    });
    await db.insert(employees).values({
      id: ids.employee,
      organizationId: ids.org,
      userId: ids.user,
      employeeNumber: "NX83",
      employmentStatus: "active",
      primaryBranchId: ids.branch,
      profile: { name: "NX83 Guard" },
    });
    await db.insert(shifts).values({
      id: ids.shift,
      postId: ids.post,
      scheduledStart: new Date(context.scheduledStart),
      scheduledEnd: new Date(context.scheduledEnd),
      timezone: "UTC",
      status: "PUBLISHED",
    });
    await db.insert(shiftAssignments).values({
      id: ids.assignment,
      shiftId: ids.shift,
      employeeId: ids.employee,
      status: "assigned",
      assignedAt: new Date(),
    });
    await db.insert(incidentReports).values([
      {
        id: ids.legacy,
        siteId: ids.site,
        shiftAssignmentId: ids.assignment,
        reportedByUserId: ids.user,
        incidentNumber: "INC-LEGACY",
        classification: "SECURITY",
        severity: "LOW",
        occurredAt: new Date(),
        narrative: "Legacy",
        actionsTaken: "Recorded",
        status: "SUBMITTED",
        visibility: "INTERNAL",
      },
      {
        id: ids.zero,
        siteId: ids.site,
        shiftAssignmentId: ids.assignment,
        reportedByUserId: ids.user,
        incidentNumber: "INC-ZERO",
        classification: "SECURITY",
        severity: "LOW",
        occurredAt: new Date(),
        narrative: "No participants",
        actionsTaken: "Recorded",
        status: "SUBMITTED",
        visibility: "INTERNAL",
      },
    ]);
    await db.insert(incidentParticipants).values({
      incidentReportId: ids.legacy,
      participantType: "LEGACY_VICTIM",
      name: "Historical person",
      details: { involvementSummary: "Historical row" },
    });
  });

  afterAll(async () => {
    if (!db || !pool) return;
    const incidentIds = (
      await db
        .select({ id: incidentReports.id })
        .from(incidentReports)
        .where(eq(incidentReports.shiftAssignmentId, ids.assignment))
    ).map((row) => row.id);
    if (incidentIds.length)
      await db
        .delete(incidentParticipants)
        .where(inArray(incidentParticipants.incidentReportId, incidentIds));
    await db
      .delete(incidentReports)
      .where(eq(incidentReports.shiftAssignmentId, ids.assignment));
    await db.delete(auditEvents).where(eq(auditEvents.organizationId, ids.org));
    await db
      .delete(shiftAssignments)
      .where(eq(shiftAssignments.id, ids.assignment));
    await db.delete(shifts).where(eq(shifts.id, ids.shift));
    await db.delete(employees).where(eq(employees.id, ids.employee));
    await db.delete(users).where(eq(users.id, ids.user));
    await db.delete(posts).where(eq(posts.id, ids.post));
    await db.delete(sites).where(inArray(sites.id, [ids.site, ids.otherSite]));
    await db
      .delete(clients)
      .where(inArray(clients.id, [ids.client, ids.otherClient]));
    await db
      .delete(branches)
      .where(inArray(branches.id, [ids.branch, ids.otherBranch]));
    await db
      .delete(organizations)
      .where(inArray(organizations.id, [ids.org, ids.otherOrg]));
    await pool.end();
  });

  it("commits incident and ordered participants atomically and deduplicates replay", async () => {
    const input = {
      ...incident("atomic"),
      participants: [
        ...incident("atomic").participants,
        {
          type: "AGENCY" as const,
          involvementSummary: "Responded.",
          agencyName: "Fire Department",
        },
      ],
    };
    const [first, second] = await Promise.all([
      repo.createIncident(scope, context, input, audit),
      repo.createIncident(scope, context, input, audit),
    ]);
    expect(first.id).toBe(second.id);
    const rows = await db
      .select()
      .from(incidentParticipants)
      .where(eq(incidentParticipants.incidentReportId, first.id));
    expect(rows).toHaveLength(2);
    const review = await repo.getReviewRecord(
      scope,
      "IncidentReport",
      first.id,
      25,
    );
    expect(review?.snapshot.participants as unknown[]).toHaveLength(2);
  });

  it("rolls back the incident when participant persistence fails", async () => {
    await pool.query(
      "ALTER TABLE incident_participants ADD CONSTRAINT nx83_reject_test CHECK (participant_type <> 'OTHER')",
    );
    try {
      await expect(
        repo.createIncident(
          scope,
          context,
          {
            ...incident("rollback"),
            participants: [
              {
                type: "OTHER",
                relationshipLabel: "Reporting party",
                involvementSummary: "Responded",
              },
            ],
          },
          audit,
        ),
      ).rejects.toThrow();
    } finally {
      await pool.query(
        "ALTER TABLE incident_participants DROP CONSTRAINT nx83_reject_test",
      );
    }
    expect(
      await db
        .select()
        .from(incidentReports)
        .where(
          and(
            eq(incidentReports.shiftAssignmentId, ids.assignment),
            eq(incidentReports.submissionKey, "rollback"),
          ),
        ),
    ).toHaveLength(0);
  });

  it("preserves legacy and zero-participant review while denying cross-tenant lookup", async () => {
    const legacy = await repo.getReviewRecord(
      scope,
      "IncidentReport",
      ids.legacy,
      25,
    );
    expect(legacy?.snapshot.participants).toEqual([
      expect.objectContaining({ type: "LEGACY_VICTIM", legacy: true }),
    ]);
    expect(
      (await repo.getReviewRecord(scope, "IncidentReport", ids.zero, 25))
        ?.snapshot,
    ).toEqual({});
    expect(
      await repo.getReviewRecord(
        { ...scope, organizationId: ids.otherOrg },
        "IncidentReport",
        ids.legacy,
        25,
      ),
    ).toBeNull();
    expect(
      (await repo.listIncidents(scope, ["INTERNAL"], 100)).find(
        (row) => row.id === ids.legacy,
      ),
    ).not.toHaveProperty("participants");
  });

  it("enforces participant and incident foreign keys", async () => {
    await expect(
      db.insert(incidentParticipants).values({
        incidentReportId: id("999"),
        participantType: "SUBJECT",
        details: {},
      }),
    ).rejects.toThrow();
  });
});
