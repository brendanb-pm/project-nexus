import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { count, eq } from "drizzle-orm";
import { Pool } from "pg";
import { PostgresReportingHubRepository } from "@/features/reporting-hub/postgres-repository";
import {
  activityEntries,
  branches,
  clients,
  employees,
  endOfShiftReports,
  incidentReports,
  organizations,
  posts,
  reportingExceptionEvents,
  reportingExceptions,
  shiftAssignments,
  shifts,
  sites,
  users,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";

const enabled = process.env.NEXUS_POSTGRES_TEST === "true";
const suite = enabled ? describe.sequential : describe.skip;

suite("NX-8.6 PostgreSQL reporting browse", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: PostgresReportingHubRepository;
  let queryCount = 0;
  const ids = {
    org: randomUUID(),
    otherOrg: randomUUID(),
    branch: randomUUID(),
    otherBranch: randomUUID(),
    client: randomUUID(),
    otherClient: randomUUID(),
    site: randomUUID(),
    otherSite: randomUUID(),
    post: randomUUID(),
    user: randomUUID(),
    employee: randomUUID(),
    shift: randomUUID(),
    assignment: randomUUID(),
    eosr: randomUUID(),
    exception: randomUUID(),
  };
  const now = new Date("2026-09-22T12:00:00.000Z");
  const scope = {
    organizationId: ids.org,
    organizationWide: true,
    branchIds: [] as string[],
    clientIds: [] as string[],
    siteIds: [] as string[],
  };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL && existsSync(".env.local"))
      process.loadEnvFile(".env.local");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
    db = drizzle(pool, { schema });

    await db.insert(organizations).values([
      { id: ids.org, name: "NX86", status: "active" },
      { id: ids.otherOrg, name: "Other", status: "active" },
    ]);
    await db.insert(branches).values([
      {
        id: ids.branch,
        organizationId: ids.org,
        name: "NX86",
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
        name: "NX86",
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
        name: "NX86 Site",
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
      name: "NX86 Post",
      description: "Read-model acceptance",
      serviceType: "site_security",
      armedRequirement: "UNARMED",
    });
    await db.insert(users).values({
      id: ids.user,
      organizationId: ids.org,
      email: `nx86-${ids.user}@example.test`,
      status: "active",
    });
    await db.insert(employees).values({
      id: ids.employee,
      organizationId: ids.org,
      userId: ids.user,
      employeeNumber: `NX86-${ids.employee}`,
      employmentStatus: "active",
      primaryBranchId: ids.branch,
      profile: { name: "NX86 Guard" },
    });
    await db.insert(shifts).values({
      id: ids.shift,
      postId: ids.post,
      scheduledStart: new Date("2026-09-22T00:00:00.000Z"),
      scheduledEnd: new Date("2026-09-22T08:00:00.000Z"),
      timezone: "UTC",
      status: "COMPLETED",
    });
    await db.insert(shiftAssignments).values({
      id: ids.assignment,
      shiftId: ids.shift,
      employeeId: ids.employee,
      status: "confirmed",
      assignedAt: new Date("2026-09-21T20:00:00.000Z"),
    });
    await db.insert(activityEntries).values(
      Array.from({ length: 55 }, (_, index) => ({
        id: randomUUID(),
        shiftAssignmentId: ids.assignment,
        occurredAt: new Date(now.valueOf() - (index + 1) * 60_000),
        category: "PATROL",
        description: { narrative: `NX86 activity ${index}` },
        submissionKey: `nx86-${ids.org}-${index}`,
        visibility: "INTERNAL" as const,
        status: "SUBMITTED" as const,
      })),
    );
    await db.insert(incidentReports).values({
      siteId: ids.site,
      shiftAssignmentId: ids.assignment,
      reportedByUserId: ids.user,
      incidentNumber: `NX86-${ids.org}`,
      classification: "SECURITY",
      severity: "LOW",
      occurredAt: new Date("2026-09-22T10:30:00.000Z"),
      narrative: "NX86 security incident",
      actionsTaken: "Recorded",
      status: "SUBMITTED",
      visibility: "INTERNAL",
    });
    await db.insert(endOfShiftReports).values({
      id: ids.eosr,
      shiftAssignmentId: ids.assignment,
      submittedByUserId: ids.user,
      summary: "NX86 closeout",
      submissionKey: `nx86-eosr-${ids.org}`,
      submittedAt: new Date("2026-09-22T11:00:00.000Z"),
    });
    await db.insert(reportingExceptions).values({
      id: ids.exception,
      organizationId: ids.org,
      shiftAssignmentId: ids.assignment,
      obligationKey: `nx86-obligation-${ids.org}`,
      obligationType: "EOSR",
      classification: "LATE",
      state: "OPEN",
      dueAt: new Date("2026-09-22T08:15:00.000Z"),
      effectiveShiftEndAt: new Date("2026-09-22T08:00:00.000Z"),
      firstDetectedAt: new Date("2026-09-22T08:16:00.000Z"),
    });

    const originalQuery = pool.query.bind(pool);
    pool.query = ((...args: Parameters<typeof pool.query>) => {
      queryCount += 1;
      return originalQuery(...args);
    }) as typeof pool.query;
    repository = new PostgresReportingHubRepository(db);
  });

  afterAll(async () => {
    if (!db || !pool) return;
    await db
      .delete(reportingExceptionEvents)
      .where(eq(reportingExceptionEvents.reportingExceptionId, ids.exception));
    await db
      .delete(reportingExceptions)
      .where(eq(reportingExceptions.id, ids.exception));
    await db
      .delete(incidentReports)
      .where(eq(incidentReports.shiftAssignmentId, ids.assignment));
    await db
      .delete(endOfShiftReports)
      .where(eq(endOfShiftReports.id, ids.eosr));
    await db
      .delete(activityEntries)
      .where(eq(activityEntries.shiftAssignmentId, ids.assignment));
    await db
      .delete(shiftAssignments)
      .where(eq(shiftAssignments.id, ids.assignment));
    await db.delete(shifts).where(eq(shifts.id, ids.shift));
    await db.delete(employees).where(eq(employees.id, ids.employee));
    await db.delete(users).where(eq(users.id, ids.user));
    await db.delete(posts).where(eq(posts.id, ids.post));
    await db.delete(sites).where(eq(sites.id, ids.site));
    await db.delete(sites).where(eq(sites.id, ids.otherSite));
    await db.delete(clients).where(eq(clients.id, ids.client));
    await db.delete(clients).where(eq(clients.id, ids.otherClient));
    await db.delete(branches).where(eq(branches.id, ids.branch));
    await db.delete(branches).where(eq(branches.id, ids.otherBranch));
    await db.delete(organizations).where(eq(organizations.id, ids.org));
    await db.delete(organizations).where(eq(organizations.id, ids.otherOrg));
    await pool.end();
  });

  it("returns a stable 50-row page with explicit continuation in five bounded queries", async () => {
    queryCount = 0;
    const page = await repository.list(
      scope,
      { family: "activity", windowHours: 24 },
      {
        startsAt: "2026-09-21T12:00:00.000Z",
        endsAt: now.toISOString(),
      },
      ["INTERNAL", "SUPERVISOR", "CLIENT_VISIBLE"],
      50,
    );
    expect(queryCount).toBe(2);
    expect(page.rows).toHaveLength(50);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toMatch(/\|[0-9a-f-]{36}$/i);
    const nextPage = await repository.list(
      scope,
      { family: "activity", windowHours: 24, cursor: page.nextCursor },
      {
        startsAt: "2026-09-21T12:00:00.000Z",
        endsAt: now.toISOString(),
      },
      ["INTERNAL", "SUPERVISOR", "CLIENT_VISIBLE"],
      50,
    );
    expect(nextPage.rows).toHaveLength(5);
    expect(nextPage.hasMore).toBe(false);
    expect(
      new Set([...page.rows, ...nextPage.rows].map((row) => row.id)).size,
    ).toBe(55);
  });

  it("uses at most five set-oriented queries for all record families and performs no exception write", async () => {
    const beforeExceptions = await db
      .select({ value: count() })
      .from(reportingExceptions)
      .where(eq(reportingExceptions.organizationId, ids.org));
    const beforeEvents = await db
      .select({ value: count() })
      .from(reportingExceptionEvents)
      .where(eq(reportingExceptionEvents.reportingExceptionId, ids.exception));
    queryCount = 0;
    const page = await repository.list(
      scope,
      { windowHours: 24 },
      {
        startsAt: "2026-09-21T12:00:00.000Z",
        endsAt: now.toISOString(),
      },
      ["INTERNAL", "SUPERVISOR", "CLIENT_VISIBLE"],
      50,
    );
    expect(queryCount).toBe(5);
    expect(page.rows).toHaveLength(50);
    for (const family of ["incident", "eosr", "exception"] as const) {
      const familyPage = await repository.list(
        scope,
        { family, windowHours: 24 },
        {
          startsAt: "2026-09-21T12:00:00.000Z",
          endsAt: now.toISOString(),
        },
        ["INTERNAL", "SUPERVISOR", "CLIENT_VISIBLE"],
        50,
      );
      expect(familyPage.rows).toEqual([
        expect.objectContaining({ family, siteId: ids.site }),
      ]);
    }
    expect(
      await db
        .select({ value: count() })
        .from(reportingExceptions)
        .where(eq(reportingExceptions.organizationId, ids.org)),
    ).toEqual(beforeExceptions);
    expect(
      await db
        .select({ value: count() })
        .from(reportingExceptionEvents)
        .where(
          eq(reportingExceptionEvents.reportingExceptionId, ids.exception),
        ),
    ).toEqual(beforeEvents);
  });

  it("enforces tenant and site scope even when a filter names an unauthorized site", async () => {
    const wrongTenant = await repository.list(
      { ...scope, organizationId: ids.otherOrg },
      { windowHours: 24 },
      {
        startsAt: "2026-09-21T12:00:00.000Z",
        endsAt: now.toISOString(),
      },
      ["INTERNAL"],
      50,
    );
    expect(wrongTenant.rows).toEqual([]);
    expect(wrongTenant.sites.map((site) => site.id)).toEqual([ids.otherSite]);

    const forgedSite = await repository.list(
      {
        ...scope,
        organizationWide: false,
        siteIds: [ids.site],
      },
      { siteId: ids.otherSite, windowHours: 24 },
      {
        startsAt: "2026-09-21T12:00:00.000Z",
        endsAt: now.toISOString(),
      },
      ["INTERNAL"],
      50,
    );
    expect(forgedSite.rows).toEqual([]);
    expect(forgedSite.sites).toEqual([{ id: ids.site, name: "NX86 Site" }]);
  });

  it("applies lifecycle status only to compatible record families", async () => {
    const page = await repository.list(
      scope,
      { status: "OPEN", windowHours: 24 },
      {
        startsAt: "2026-09-21T12:00:00.000Z",
        endsAt: now.toISOString(),
      },
      ["INTERNAL", "SUPERVISOR", "CLIENT_VISIBLE"],
      50,
    );
    expect(page.rows).toEqual([
      expect.objectContaining({ family: "exception", status: "OPEN" }),
    ]);
  });
});
