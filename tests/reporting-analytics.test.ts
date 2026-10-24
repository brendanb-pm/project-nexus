import { describe, expect, it } from "vitest";
import { buildReportingAnalytics } from "@/features/reporting-analytics/rollup";
import { parseAnalyticsFilters } from "@/features/reporting-analytics/application";
import type { AnalyticsSources } from "@/features/reporting-analytics/contracts";
import { ReportingAnalyticsService } from "@/features/reporting-analytics/service";
import { resolveCapabilities, resolveVisibility } from "@/auth/authorization";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import type { AuthenticatedRequestContext } from "@/server/request/context";
import type { Role } from "@/domain/model";

const location = {
  siteId: "00000000-0000-4000-8000-000000000010",
  siteName: "Cedar",
  timezone: "America/Los_Angeles",
  clientId: "00000000-0000-4000-8000-000000000020",
  clientName: "Client A",
  branchId: "00000000-0000-4000-8000-000000000030",
  branchName: "West",
};
const window = {
  startsAt: "2026-09-26T00:00:00.000Z",
  endsAt: "2026-09-27T00:00:00.000Z",
  asOf: "2026-09-27T00:00:00.000Z",
  timezone: "UTC" as const,
};
const filters = { windowHours: 24 as const };

describe("NX-8.11 reporting analytics", () => {
  it("uses approved EOSR plus Activity definition A; EOSR-only is not complete", () => {
    const sources: AnalyticsSources = {
      assignments: [
        {
          ...location,
          eligible: 3,
          due: 3,
          completed: 1,
          eosrOnly: 2,
          onTimeCloseout: 1,
          activitySatisfied: 2,
          activityDueSatisfied: 2,
        },
      ],
      incidents: [
        { ...location, classification: "SECURITY", severity: "HIGH", count: 2 },
      ],
      exceptions: [
        {
          ...location,
          state: "OPEN",
          count: 1,
          openCount: 1,
          ageHours: 4,
          turnaroundHours: 0,
          turnaroundCount: 0,
        },
      ],
    };
    const result = buildReportingAnalytics(sources, false, filters, window);
    expect(result.portfolio.shiftReportCompletion).toEqual({
      numerator: 1,
      denominator: 3,
      percent: 33.3,
    });
    expect(result.portfolio.eosrOnlyCount).toBe(2);
    expect(result.portfolio.activityCoverage.numerator).toBe(2);
    expect(result.portfolio.onTimeCloseout.numerator).toBe(1);
    expect(result.portfolio.incidentCount).toBe(2);
    expect(result.portfolio.openExceptionCount).toBe(1);
    expect(result.scopeLabel).toBe("Authorized portfolio");
  });

  it("uses null rather than zero percent when no worked assignment is eligible", () => {
    const result = buildReportingAnalytics(
      { assignments: [], incidents: [], exceptions: [] },
      true,
      filters,
      window,
    );
    expect(result.portfolio.shiftReportCompletion).toEqual({
      numerator: 0,
      denominator: 0,
      percent: null,
    });
    expect(result.portfolio.correctionTurnaroundHours).toBeNull();
  });

  it("aggregates all sites before applying the 50-site display limit", () => {
    const assignments = Array.from({ length: 51 }, (_, index) => ({
      ...location,
      siteId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      siteName: `Site ${String(index).padStart(2, "0")}`,
      eligible: 1,
      due: 1,
      completed: 1,
      eosrOnly: 1,
      onTimeCloseout: 1,
      activitySatisfied: 1,
      activityDueSatisfied: 1,
    }));
    const result = buildReportingAnalytics(
      { assignments, incidents: [], exceptions: [] },
      true,
      filters,
      window,
    );
    expect(result.portfolio.shiftReportCompletion.denominator).toBe(51);
    expect(result.sites).toHaveLength(50);
    expect(result.hasMoreSites).toBe(true);
    const secondPage = buildReportingAnalytics(
      { assignments, incidents: [], exceptions: [] },
      true,
      { ...filters, sitePage: 1 },
      window,
    );
    expect(secondPage.sites).toHaveLength(1);
    expect(secondPage.hasMoreSites).toBe(false);
    expect(secondPage.portfolio.shiftReportCompletion.denominator).toBe(51);
  });

  it("bounds periods and ignores malformed filter identifiers", () => {
    expect(
      parseAnalyticsFilters({ window: "99999", siteId: "../../other" }),
    ).toEqual({ windowHours: 24 });
    expect(parseAnalyticsFilters({ window: "720" }).windowHours).toBe(720);
    expect(
      parseAnalyticsFilters({
        incidentClassification: "OTHER_TENANT",
        incidentStatus: "DRAFT",
      }),
    ).toEqual({ windowHours: 24 });
    expect(
      parseAnalyticsFilters({
        incidentClassification: "SECURITY",
        incidentSeverity: "HIGH",
      }),
    ).toMatchObject({
      incidentClassification: "SECURITY",
      incidentSeverity: "HIGH",
    });
  });

  it.each([
    "SUPERVISOR",
    "OPERATIONS_MANAGER",
    "LEADERSHIP",
    "ADMIN",
  ] as Role[])("allows %s using server-derived scope", async (role) => {
    const actor = {
      userId: "00000000-0000-4000-8000-000000000201",
      organizationId: "00000000-0000-4000-8000-000000000202",
      roles: [role],
      branchIds: [],
      clientIds: [],
      siteIds: [location.siteId],
      organizationWide: false,
    };
    const context: AuthenticatedRequestContext = {
      actor,
      organizationId: actor.organizationId,
      capabilities: resolveCapabilities(actor),
      visibility: resolveVisibility(actor),
      scope: {
        organizationWide: false,
        branchIds: [],
        clientIds: [],
        siteIds: [location.siteId],
      },
      request: {
        id: "nx811",
        operation: "analytics.test",
        startedAt: window.asOf,
      },
      authentication: {},
    };
    let calledScope: unknown;
    const service = new ReportingAnalyticsService(
      new AuthorizedDataAccess(context),
      {
        load: async (scope) => {
          calledScope = scope;
          return { assignments: [], incidents: [], exceptions: [] };
        },
      },
      () => new Date(window.asOf),
    );
    await service.load(filters);
    expect(calledScope).toMatchObject({
      organizationId: actor.organizationId,
      siteIds: [location.siteId],
    });
  });

  it.each(["GUARD", "CLIENT_USER"] as Role[])(
    "denies %s before any query",
    async (role) => {
      const actor = {
        userId: "00000000-0000-4000-8000-000000000201",
        organizationId: "00000000-0000-4000-8000-000000000202",
        roles: [role],
        branchIds: [],
        clientIds: [],
        siteIds: [],
        organizationWide: true,
      };
      const context: AuthenticatedRequestContext = {
        actor,
        organizationId: actor.organizationId,
        capabilities: resolveCapabilities(actor),
        visibility: resolveVisibility(actor),
        scope: {
          organizationWide: true,
          branchIds: [],
          clientIds: [],
          siteIds: [],
        },
        request: {
          id: "nx811",
          operation: "analytics.test",
          startedAt: window.asOf,
        },
        authentication: {},
      };
      const service = new ReportingAnalyticsService(
        new AuthorizedDataAccess(context),
        {
          load: async () => {
            throw new Error("Repository must not be called");
          },
        },
      );
      await expect(service.load(filters)).rejects.toThrow();
    },
  );
});
