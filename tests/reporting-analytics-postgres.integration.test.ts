import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { PostgresReportingAnalyticsRepository } from "@/features/reporting-analytics/postgres-repository";
import type { NexusDatabase } from "@/server/db/client";
import {
  activityEntries,
  branches,
  clients,
  clockEvents,
  endOfShiftReports,
  incidentReports,
  shiftAssignments,
  shifts,
  sites,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";

const suite =
  process.env.NEXUS_POSTGRES_TEST === "true" ? describe : describe.skip;
const scope = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  organizationWide: true,
  branchIds: [] as string[],
  clientIds: [] as string[],
  siteIds: [] as string[],
};
const filters = { windowHours: 24 as const };
const ids = {
  post: "00000000-0000-4000-8000-000000000040",
  user: "00000000-0000-4000-8000-000000000050",
  employee: "00000000-0000-4000-8000-000000000060",
  shift: "00000000-0000-4000-8000-000000008811",
  assignment: "00000000-0000-4000-8000-000000008812",
  clock: "00000000-0000-4000-8000-000000008813",
  clockOut: "00000000-0000-4000-8000-000000008822",
  eosr: "00000000-0000-4000-8000-000000008814",
  draftIncident: "00000000-0000-4000-8000-000000008815",
  submittedIncident: "00000000-0000-4000-8000-000000008816",
  secondBranch: "00000000-0000-4000-8000-000000008817",
  secondClient: "00000000-0000-4000-8000-000000008818",
  secondSite: "00000000-0000-4000-8000-000000008819",
  secondIncident: "00000000-0000-4000-8000-000000008820",
  activity: "00000000-0000-4000-8000-000000008821",
  site: "00000000-0000-4000-8000-000000000030",
};

suite("NX-8.11 PostgreSQL read-only analytics", () => {
  it("counts EOSR-only work in definition B but not approved definition A, without persisting fixtures", async () => {
    if (!process.env.DATABASE_URL)
      throw new Error("Isolated DATABASE_URL is required.");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const database = drizzle(pool, { schema });
    const asOf = new Date();
    const end = new Date(asOf.valueOf() - 2 * 60 * 60_000);
    const scheduledEnd = new Date(asOf.valueOf() - 25 * 60 * 60_000);
    const start = new Date(scheduledEnd.valueOf() - 8 * 60 * 60_000);
    const window = {
      startsAt: new Date(asOf.valueOf() - 24 * 60 * 60_000).toISOString(),
      endsAt: asOf.toISOString(),
      asOf: asOf.toISOString(),
    };
    try {
      const repository = new PostgresReportingAnalyticsRepository(database);
      const before = await repository.load(scope, filters, window);
      await expect(
        database.transaction(async (tx) => {
          await tx.insert(shifts).values({
            id: ids.shift,
            postId: ids.post,
            scheduledStart: start,
            scheduledEnd,
            timezone: "America/Los_Angeles",
            status: "COMPLETED",
          });
          await tx.insert(shiftAssignments).values({
            id: ids.assignment,
            shiftId: ids.shift,
            employeeId: ids.employee,
            status: "confirmed",
            assignedAt: start,
          });
          await tx.insert(clockEvents).values({
            id: ids.clock,
            shiftAssignmentId: ids.assignment,
            eventType: "CLOCK_IN",
            occurredAt: start,
            effectiveAt: start,
            recordedByUserId: ids.user,
            verificationStatus: "NORMAL",
          });
          await tx.insert(clockEvents).values({
            id: ids.clockOut,
            shiftAssignmentId: ids.assignment,
            eventType: "CLOCK_OUT",
            occurredAt: end,
            effectiveAt: end,
            recordedByUserId: ids.user,
            verificationStatus: "NORMAL",
          });
          await tx.insert(endOfShiftReports).values({
            id: ids.eosr,
            shiftAssignmentId: ids.assignment,
            submittedByUserId: ids.user,
            summary: "Closeout without required activity",
            submissionKey: "nx811-eosr-only",
            submittedAt: end,
          });
          await tx.insert(branches).values({
            id: ids.secondBranch,
            organizationId: scope.organizationId,
            name: "NX811 Branch Two",
            timezone: "America/Los_Angeles",
            status: "active",
          });
          await tx.insert(clients).values({
            id: ids.secondClient,
            organizationId: scope.organizationId,
            branchId: ids.secondBranch,
            name: "NX811 Client Two",
            status: "active",
          });
          await tx.insert(sites).values({
            id: ids.secondSite,
            clientId: ids.secondClient,
            name: "NX811 Site Two",
            address: {},
            timezone: "America/Los_Angeles",
          });
          await tx.insert(incidentReports).values([
            {
              id: ids.draftIncident,
              siteId: ids.site,
              incidentNumber: "NX811-DRAFT",
              classification: "SECURITY",
              severity: "HIGH",
              occurredAt: end,
              narrative: "Draft fixture",
              actionsTaken: "None",
              status: "DRAFT",
            },
            {
              id: ids.submittedIncident,
              siteId: ids.site,
              incidentNumber: "NX811-SUBMITTED",
              classification: "SECURITY",
              severity: "HIGH",
              occurredAt: end,
              narrative: "Submitted fixture",
              actionsTaken: "Reviewed",
              status: "SUBMITTED",
            },
            {
              id: ids.secondIncident,
              siteId: ids.secondSite,
              incidentNumber: "NX811-SECOND-SITE",
              classification: "SAFETY",
              severity: "MEDIUM",
              occurredAt: end,
              narrative: "Second site fixture",
              actionsTaken: "Reviewed",
              status: "SUBMITTED",
            },
          ]);
          const inside = await new PostgresReportingAnalyticsRepository(
            tx as unknown as NexusDatabase,
          ).load(scope, filters, window);
          const count = (
            rows: typeof inside.assignments,
            field: "eligible" | "completed" | "eosrOnly",
          ) => rows.reduce((total, row) => total + row[field], 0);
          expect(
            count(inside.assignments, "eligible") -
              count(before.assignments, "eligible"),
          ).toBe(1);
          expect(
            count(inside.assignments, "eosrOnly") -
              count(before.assignments, "eosrOnly"),
          ).toBe(1);
          expect(
            count(inside.assignments, "completed") -
              count(before.assignments, "completed"),
          ).toBe(0);
          await tx.insert(activityEntries).values({
            id: ids.activity,
            shiftAssignmentId: ids.assignment,
            occurredAt: end,
            category: "PATROL",
            description: { text: "Completed required activity" },
            submissionKey: "nx811-activity",
            status: "SUBMITTED",
          });
          const withActivity = await new PostgresReportingAnalyticsRepository(
            tx as unknown as NexusDatabase,
          ).load(scope, filters, window);
          expect(
            count(withActivity.assignments, "completed") -
              count(inside.assignments, "completed"),
          ).toBe(1);
          expect(
            count(withActivity.assignments, "eosrOnly") -
              count(inside.assignments, "eosrOnly"),
          ).toBe(0);
          const incidentCount = (rows: typeof inside.incidents) =>
            rows.reduce((sum, row) => sum + row.count, 0);
          expect(
            incidentCount(inside.incidents) - incidentCount(before.incidents),
          ).toBe(2);
          expect(
            inside.incidents.some((row) => row.siteId === ids.secondSite),
          ).toBe(true);
          const secondBranchOnly =
            await new PostgresReportingAnalyticsRepository(
              tx as unknown as NexusDatabase,
            ).load(
              {
                ...scope,
                organizationWide: false,
                branchIds: [ids.secondBranch],
              },
              filters,
              window,
            );
          expect(
            secondBranchOnly.incidents.every(
              (row) => row.siteId === ids.secondSite,
            ),
          ).toBe(true);
          expect(
            secondBranchOnly.incidents.some(
              (row) => row.siteId === ids.secondSite,
            ),
          ).toBe(true);
          const denied = await new PostgresReportingAnalyticsRepository(
            tx as unknown as NexusDatabase,
          ).load(
            {
              ...scope,
              organizationId: "00000000-0000-4000-8000-000000000999",
            },
            filters,
            window,
          );
          expect(denied.assignments).toEqual([]);
          const wrongSite = await new PostgresReportingAnalyticsRepository(
            tx as unknown as NexusDatabase,
          ).load(
            {
              ...scope,
              organizationWide: false,
              siteIds: ["00000000-0000-4000-8000-000000000999"],
            },
            filters,
            window,
          );
          expect(wrongSite.assignments).toEqual([]);
          expect(wrongSite.incidents).toEqual([]);
          expect(wrongSite.exceptions).toEqual([]);
          for (const restricted of [
            {
              ...scope,
              organizationWide: false,
              clientIds: ["00000000-0000-4000-8000-000000000999"],
            },
            {
              ...scope,
              organizationWide: false,
              branchIds: ["00000000-0000-4000-8000-000000000999"],
            },
          ]) {
            const result = await new PostgresReportingAnalyticsRepository(
              tx as unknown as NexusDatabase,
            ).load(restricted, filters, window);
            expect(result).toEqual({
              assignments: [],
              incidents: [],
              exceptions: [],
            });
          }
          throw new Error("ROLL_BACK_NX811_FIXTURE");
        }),
      ).rejects.toThrow("ROLL_BACK_NX811_FIXTURE");
      const after = await repository.load(scope, filters, window);
      expect(after).toEqual(before);
    } finally {
      await pool.end();
    }
  });
});
