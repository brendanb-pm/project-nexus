import { describe, expect, it } from "vitest";
import { resolveCapabilities, resolveVisibility } from "@/auth/authorization";
import {
  loadReportingHub,
  parseReportHubFilters,
} from "@/features/reporting-hub/application";
import type { ReportHubFilters } from "@/features/reporting-hub/contracts";
import type { ReportingHubRepository } from "@/features/reporting-hub/repository";
import { ReportingHubService } from "@/features/reporting-hub/service";
import type { Role } from "@/domain/model";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import type { AuthenticatedRequestContext } from "@/server/request/context";

class Repository implements ReportingHubRepository {
  calls: Parameters<ReportingHubRepository["list"]>[] = [];

  async list(...args: Parameters<ReportingHubRepository["list"]>) {
    this.calls.push(args);
    return { sites: [], sitesLimited: false, rows: [], hasMore: false };
  }
}

function subject(
  role: Role,
  scope: AuthenticatedRequestContext["scope"] = {
    organizationWide: true,
    branchIds: [],
    clientIds: [],
    siteIds: [],
  },
) {
  const actor = {
    userId: "00000000-0000-4000-8000-000000008601",
    organizationId: "00000000-0000-4000-8000-000000008602",
    roles: [role],
    branchIds: [...scope.branchIds],
    clientIds: [...scope.clientIds],
    siteIds: [...scope.siteIds],
    organizationWide: scope.organizationWide,
    ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
  };
  const context: AuthenticatedRequestContext = {
    actor,
    organizationId: actor.organizationId,
    scope,
    capabilities: resolveCapabilities(actor),
    visibility: resolveVisibility(actor),
    request: {
      id: "nx86-test",
      startedAt: "2026-09-22T12:00:00.000Z",
      operation: "reports.test",
    },
    authentication: {},
  };
  const repository = new Repository();
  return {
    repository,
    service: new ReportingHubService(
      new AuthorizedDataAccess(context),
      repository,
      () => new Date("2026-09-22T12:00:00.000Z"),
    ),
  };
}

const filters: ReportHubFilters = { windowHours: 24 };

describe("NX-8.6 Reporting Hub", () => {
  it("normalizes filters to approved bounded values", () => {
    expect(parseReportHubFilters({})).toEqual({ windowHours: 24 });
    expect(
      parseReportHubFilters({
        siteId: "00000000-0000-4000-8000-000000008607",
        family: "incident",
        status: "SUBMITTED",
        window: "720",
        cursor: "2026-09-22T12:00:00.000Z|00000000-0000-4000-8000-000000008608",
      }),
    ).toEqual({
      siteId: "00000000-0000-4000-8000-000000008607",
      family: "incident",
      status: "SUBMITTED",
      windowHours: 720,
      cursor: "2026-09-22T12:00:00.000Z|00000000-0000-4000-8000-000000008608",
    });
    expect(
      parseReportHubFilters({
        siteId: "forged",
        family: "payroll",
        status: "SECRET",
        window: "99999",
      }),
    ).toEqual({ windowHours: 24 });
  });

  it.each([
    ["CLIENT_USER", "client"],
    ["LEADERSHIP", "leadership"],
  ] as const)(
    "returns only the %s canonical destination",
    async (role, kind) => {
      const { service, repository } = subject(role);
      await expect(service.load(filters)).resolves.toEqual({ kind });
      expect(repository.calls).toHaveLength(0);
    },
  );

  it("requires an authoritative employee identity for the Guard destination", async () => {
    const missingEmployee = subject("GUARD");
    await expect(missingEmployee.service.load(filters)).resolves.toEqual({
      kind: "denied",
    });
    const guard = subject("GUARD", {
      organizationWide: false,
      branchIds: [],
      clientIds: [],
      siteIds: [],
      employeeId: "00000000-0000-4000-8000-000000008606",
    });
    await expect(guard.service.load(filters)).resolves.toEqual({
      kind: "guard",
    });
    expect(guard.repository.calls).toHaveLength(0);
  });

  it("uses authoritative internal scope, visibility, a 50-row bound, and a 24-hour window", async () => {
    const scope = {
      organizationWide: false,
      branchIds: ["00000000-0000-4000-8000-000000008603"],
      clientIds: [],
      siteIds: ["00000000-0000-4000-8000-000000008607"],
    };
    const { service, repository } = subject("SUPERVISOR", scope);
    await expect(service.load(filters)).resolves.toMatchObject({
      kind: "internal",
      scopeLabel: "Authorized portfolio",
    });
    expect(repository.calls).toHaveLength(1);
    expect(repository.calls[0]).toEqual([
      { organizationId: "00000000-0000-4000-8000-000000008602", ...scope },
      filters,
      {
        startsAt: "2026-09-21T12:00:00.000Z",
        endsAt: "2026-09-22T12:00:00.000Z",
      },
      ["INTERNAL", "SUPERVISOR", "CLIENT_VISIBLE"],
      50,
    ]);
  });

  it("fails closed for a missing session and converts repository failure to a controlled state", async () => {
    await expect(
      loadReportingHub(
        Promise.reject(new Error("database connection details")),
        {},
      ),
    ).resolves.toEqual({
      kind: "error",
      message:
        "Reports are temporarily unavailable. No reporting data was changed.",
    });
  });
});
