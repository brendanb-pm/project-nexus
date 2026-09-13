import { describe, expect, it } from "vitest";
import { buildLeadershipDashboard } from "@/features/leadership-dashboard/dashboard";
import type { LeadershipDashboardSources } from "@/features/leadership-dashboard/contracts";
import { LeadershipDashboardService } from "@/features/leadership-dashboard/service";
import type { LeadershipDashboardRepository } from "@/features/leadership-dashboard/repository";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { PermissionDeniedError } from "@/server/request/errors";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";

const window = {
  startsAt: "2026-09-01T00:00:00.000Z",
  endsAt: "2026-09-02T00:00:00.000Z",
  asOf: "2026-09-01T12:00:00.000Z",
};

const sources = (
  overrides: Partial<LeadershipDashboardSources> = {},
): LeadershipDashboardSources => ({
  hierarchy: {
    clients: [{ id: "client-1", name: "Cedar Plaza" }],
    sites: [{ id: "site-1", clientId: "client-1", name: "North" }],
  },
  scorecards: {
    sites: [
      {
        id: "site-1",
        clientId: "client-1",
        branchId: "branch-1",
        name: "North",
        timezone: "UTC",
      },
    ],
    posts: [{ id: "post-1", siteId: "site-1", name: "Lobby" }],
    requirements: [
      {
        id: "requirement-current",
        postId: "post-1",
        siteId: "site-1",
        clientId: "client-1",
        branchId: "branch-1",
        timezone: "UTC",
        requiredCount: 1,
        weekdays: ["TUESDAY"],
        localStartTime: "08:00:00",
        localEndTime: "14:00:00",
        effectiveStart: "2026-01-01",
        active: true,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "requirement-upcoming",
        postId: "post-1",
        siteId: "site-1",
        clientId: "client-1",
        branchId: "branch-1",
        timezone: "UTC",
        requiredCount: 1,
        weekdays: ["TUESDAY"],
        localStartTime: "18:00:00",
        localEndTime: "20:00:00",
        effectiveStart: "2026-01-01",
        active: true,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    assignments: [
      {
        id: "assignment-1",
        postId: "post-1",
        startsAt: "2026-09-01T01:00:00.000Z",
        endsAt: "2026-09-01T02:00:00.000Z",
        clockOut: false,
      },
    ],
    incidents: [],
  },
  compliance: {
    credentials: [],
    requirements: [],
    assignments: [],
  },
  ...overrides,
});

describe("NX-6.4 leadership dashboard read model", () => {
  it("reuses canonical scorecard coverage, gaps, close state, and unavailable actual-time semantics", () => {
    const dashboard = buildLeadershipDashboard(sources(), window, true, {});
    expect(dashboard.scopeLabel).toBe("Organization");
    expect(dashboard.operationalHealth.coveragePercent).toBe(0);
    expect(dashboard.operationalHealth.currentGapCount).toBe(1);
    expect(dashboard.operationalHealth.upcomingGapCount).toBe(1);
    expect(dashboard.operationalHealth.actual.seconds).toBeNull();
    expect(dashboard.operationalHealth.actual.sourceState).toBe("UNAVAILABLE");
    expect(dashboard.operationalHealth.shiftClose).toEqual({
      due: 1,
      complete: 0,
      incomplete: 1,
    });
    expect(dashboard.exceptions[0]).toMatchObject({
      status: "CRITICAL",
      postId: "post-1",
    });
  });

  it("keeps coverage null when no requirement applies rather than rendering zero", () => {
    const dashboard = buildLeadershipDashboard(
      sources({ scorecards: { ...sources().scorecards, requirements: [] } }),
      window,
      false,
      {},
    );
    expect(dashboard.scopeLabel).toBe("Authorized portfolio");
    expect(dashboard.operationalHealth.coveragePercent).toBeNull();
    expect(dashboard.operationalHealth.required.seconds).toBeNull();
  });

  it("excludes drafts and de-duplicates submitted incidents by canonical incident id", () => {
    const dashboard = buildLeadershipDashboard(
      sources({
        scorecards: {
          ...sources().scorecards,
          incidents: [
            {
              id: "draft",
              siteId: "site-1",
              postId: "post-1",
              occurredAt: window.asOf,
              status: "DRAFT",
            },
            {
              id: "submitted",
              siteId: "site-1",
              postId: "post-1",
              occurredAt: window.asOf,
              status: "SUBMITTED",
            },
            {
              id: "submitted",
              siteId: "site-1",
              postId: "post-1",
              occurredAt: window.asOf,
              status: "ACKNOWLEDGED",
            },
          ],
        },
      }),
      window,
      true,
      {},
    );
    expect(dashboard.incidents.submittedOrLater).toBe(1);
  });

  it("returns aggregate compliance risk without employee or credential detail fields", () => {
    const dashboard = buildLeadershipDashboard(
      sources({
        compliance: {
          credentials: [
            {
              id: "credential-1",
              employeeId: "employee-private",
              employeeName: "Private Guard",
              employeeNumber: "NPS-999",
              branchId: "branch-1",
              branchName: "Central",
              definitionId: "definition-1",
              key: "guard-card",
              displayName: "Guard card",
              state: "pending_verification",
              jurisdiction: { kind: "organization" },
              warningDays: [7],
            },
          ],
          requirements: [],
          assignments: [],
        },
      }),
      window,
      true,
      {},
    );
    expect(dashboard.compliance.pendingVerification).toBe(1);
    expect(JSON.stringify(dashboard)).not.toContain("Private Guard");
    expect(JSON.stringify(dashboard)).not.toContain("NPS-999");
    expect(JSON.stringify(dashboard)).not.toContain("employee-private");
  });

  it("preserves selected hierarchy context and excludes financial calculations", () => {
    const dashboard = buildLeadershipDashboard(sources(), window, true, {
      clientId: "client-1",
      siteId: "site-1",
    });
    expect(dashboard.filters.selectedClientId).toBe("client-1");
    expect(dashboard.filters.selectedSiteId).toBe("site-1");
    expect(dashboard.financial).toEqual({
      state: "UNAVAILABLE",
      message:
        "Financial performance is unavailable until canonical billing and payroll foundations are implemented.",
    });
  });
});

class MemoryRepository implements LeadershipDashboardRepository {
  scope?: Parameters<LeadershipDashboardRepository["load"]>[0];
  filters?: Parameters<LeadershipDashboardRepository["load"]>[1];
  async load(
    scope: Parameters<LeadershipDashboardRepository["load"]>[0],
    filters: Parameters<LeadershipDashboardRepository["load"]>[1],
  ) {
    this.scope = scope;
    this.filters = filters;
    return sources();
  }
}

async function service(
  role: AuthenticatedPrincipal["roles"][number],
  organizationWide = true,
) {
  const repository = new MemoryRepository();
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: {
          userId: "user-1",
          organizationId: "org-1",
          roles: [role],
          organizationWide,
          branchIds: organizationWide ? [] : ["branch-1"],
          clientIds: [],
          siteIds: [],
        },
      }),
    },
    "leadership-dashboard.test",
  );
  return {
    repository,
    service: new LeadershipDashboardService(
      new AuthorizedDataAccess(context),
      repository,
      () => new Date("2026-09-01T12:00:00.000Z"),
    ),
  };
}

describe("NX-6.4 leadership authorization", () => {
  it("allows Leadership and Admin through the analytics capability", async () => {
    await expect(
      (await service("LEADERSHIP")).service.load(),
    ).resolves.toMatchObject({ scopeLabel: "Organization" });
    await expect(
      (await service("ADMIN")).service.load(),
    ).resolves.toMatchObject({ scopeLabel: "Organization" });
  });

  it("denies Operations Manager, Supervisor, Guard, and Client User before data reads", async () => {
    for (const role of [
      "OPERATIONS_MANAGER",
      "SUPERVISOR",
      "GUARD",
      "CLIENT_USER",
    ] as const) {
      const subject = await service(role);
      await expect(subject.service.load()).rejects.toBeInstanceOf(
        PermissionDeniedError,
      );
      expect(subject.repository.scope).toBeUndefined();
    }
  });

  it("passes only the trusted authorized portfolio and filter hints to the repository", async () => {
    const subject = await service("LEADERSHIP", false);
    await subject.service.load({ clientId: "client-1", siteId: "site-1" });
    expect(subject.repository.scope).toMatchObject({
      organizationId: "org-1",
      organizationWide: false,
      branchIds: ["branch-1"],
    });
    expect(subject.repository.filters).toEqual({
      clientId: "client-1",
      siteId: "site-1",
    });
  });
});
