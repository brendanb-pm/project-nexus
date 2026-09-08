import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import { Pool } from "pg";
import { PostgresEndOfShiftReportRepository } from "@/features/eosr/postgres-repository";
import { endOfShiftReports, eosrPassdownDismissals } from "@/server/db/schema";
import * as schema from "@/server/db/schema";

const enabled = process.env.NEXUS_POSTGRES_TEST === "true";
const suite = enabled ? describe.sequential : describe.skip;
const ids = {
  organization: "00000000-0000-4000-8000-000000000001",
  site: "00000000-0000-4000-8000-000000000030",
  guardUser: "00000000-0000-4000-8000-000000000050",
  incomingGuardUser: "00000000-0000-4000-8000-000000000051",
  guardEmployee: "00000000-0000-4000-8000-000000000060",
  incomingGuardEmployee: "00000000-0000-4000-8000-000000000061",
  outgoingAssignment: "00000000-0000-4000-8000-000000000090",
  wrongPostAssignment: "00000000-0000-4000-8000-000000000097",
  report: "00000000-0000-4000-8000-000000000095",
  wrongPostReport: "00000000-0000-4000-8000-000000000096",
} as const;

suite("NX4.4 PostgreSQL passdown read model", () => {
  let pool: Pool;
  let database: ReturnType<typeof drizzle<typeof schema>>;
  let repository: PostgresEndOfShiftReportRepository;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL && existsSync(".env.local"))
      process.loadEnvFile(".env.local");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    database = drizzle(pool, { schema });
    repository = new PostgresEndOfShiftReportRepository(database);
    await database
      .delete(eosrPassdownDismissals)
      .where(
        inArray(eosrPassdownDismissals.endOfShiftReportId, [
          ids.report,
          ids.wrongPostReport,
        ]),
      );
    await database
      .delete(endOfShiftReports)
      .where(inArray(endOfShiftReports.id, [ids.report, ids.wrongPostReport]));
    await database.insert(endOfShiftReports).values([
      {
        id: ids.report,
        shiftAssignmentId: ids.outgoingAssignment,
        submittedByUserId: ids.guardUser,
        summary: "North Lobby shift completed.",
        unresolvedIssues: ["Door closer service pending."],
        equipmentAccessStatus: "Keys accounted for.",
        followUpItems: ["Confirm maintenance arrival."],
        unusualConditions: "",
        submissionKey: "postgres-integration-north",
        submittedAt: new Date(),
      },
      {
        id: ids.wrongPostReport,
        shiftAssignmentId: ids.wrongPostAssignment,
        submittedByUserId: ids.guardUser,
        summary: "South Gate shift completed.",
        unresolvedIssues: ["Wrong post test."],
        equipmentAccessStatus: "",
        followUpItems: [],
        unusualConditions: "",
        submissionKey: "postgres-integration-south",
        submittedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    if (!database || !pool) return;
    await database
      .delete(eosrPassdownDismissals)
      .where(
        inArray(eosrPassdownDismissals.endOfShiftReportId, [
          ids.report,
          ids.wrongPostReport,
        ]),
      );
    await database
      .delete(endOfShiftReports)
      .where(inArray(endOfShiftReports.id, [ids.report, ids.wrongPostReport]));
    await pool.end();
  });

  const scope = {
    organizationId: ids.organization,
    organizationWide: true,
    branchIds: [] as string[],
    clientIds: [] as string[],
    siteIds: [] as string[],
  };

  it("executes cleanly and returns only the adjacent same-post predecessor", async () => {
    const rows = await repository.listIncomingPassdowns(
      scope,
      ids.incomingGuardEmployee,
      ids.incomingGuardUser,
      new Date().toISOString(),
      25,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: ids.report,
      siteName: "Cedar Plaza North",
      postName: "North Lobby",
      dismissed: false,
    });
    expect(rows.some((item) => item.id === ids.wrongPostReport)).toBe(false);
  });

  it("excludes wrong tenant, wrong site, and unrelated Guard scopes", async () => {
    await expect(
      repository.listIncomingPassdowns(
        { ...scope, organizationId: "00000000-0000-4000-8000-000000000999" },
        ids.incomingGuardEmployee,
        ids.incomingGuardUser,
        new Date().toISOString(),
        25,
      ),
    ).resolves.toEqual([]);
    await expect(
      repository.listIncomingPassdowns(
        {
          ...scope,
          organizationWide: false,
          siteIds: ["00000000-0000-4000-8000-000000000999"],
        },
        ids.incomingGuardEmployee,
        ids.incomingGuardUser,
        new Date().toISOString(),
        25,
      ),
    ).resolves.toEqual([]);
    await expect(
      repository.listIncomingPassdowns(
        scope,
        ids.guardEmployee,
        ids.guardUser,
        new Date().toISOString(),
        25,
      ),
    ).resolves.toEqual([]);
  });

  it("persists dismissal and reopen without deleting passdown content", async () => {
    const [passdown] = await repository.listIncomingPassdowns(
      scope,
      ids.incomingGuardEmployee,
      ids.incomingGuardUser,
      new Date().toISOString(),
      25,
    );
    const audit = {
      actorUserId: ids.incomingGuardUser,
      organizationId: ids.organization,
      requestId: "postgres-integration",
    };
    await repository.setPassdownDismissal(
      scope,
      passdown!,
      ids.incomingGuardUser,
      true,
      new Date().toISOString(),
      audit,
    );
    expect(
      (
        await repository.listIncomingPassdowns(
          scope,
          ids.incomingGuardEmployee,
          ids.incomingGuardUser,
          new Date().toISOString(),
          25,
        )
      )[0],
    ).toMatchObject({ id: ids.report, dismissed: true });
    await repository.setPassdownDismissal(
      scope,
      passdown!,
      ids.incomingGuardUser,
      false,
      new Date().toISOString(),
      audit,
    );
    expect(
      (
        await repository.listIncomingPassdowns(
          scope,
          ids.incomingGuardEmployee,
          ids.incomingGuardUser,
          new Date().toISOString(),
          25,
        )
      )[0],
    ).toMatchObject({
      id: ids.report,
      dismissed: false,
      summary: "North Lobby shift completed.",
    });
  });

  it("returns a clean empty result when no applicable EOSR exists", async () => {
    await database
      .delete(eosrPassdownDismissals)
      .where(eq(eosrPassdownDismissals.endOfShiftReportId, ids.report));
    await database
      .delete(endOfShiftReports)
      .where(eq(endOfShiftReports.id, ids.report));
    await expect(
      repository.listIncomingPassdowns(
        scope,
        ids.incomingGuardEmployee,
        ids.incomingGuardUser,
        new Date().toISOString(),
        25,
      ),
    ).resolves.toEqual([]);
  });
});
