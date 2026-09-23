import { AuthorizedDataAccess } from "@/server/request/boundary";
import type { ReportHubFilters, ReportHubPageState } from "./contracts";
import type { ReportingHubRepository } from "./repository";

const PAGE_SIZE = 50;

export class ReportingHubService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: ReportingHubRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async load(filters: ReportHubFilters): Promise<ReportHubPageState> {
    const { context } = this.access;
    const roles = new Set(context.actor.roles);

    if (
      roles.has("SUPERVISOR") ||
      roles.has("OPERATIONS_MANAGER") ||
      roles.has("ADMIN")
    ) {
      this.access.requireOrganization("VIEW_SITE_OPERATIONS");
      const endsAt = this.now();
      const startsAt = new Date(
        endsAt.valueOf() - filters.windowHours * 60 * 60 * 1000,
      );
      const result = await this.repository.list(
        { organizationId: context.organizationId, ...context.scope },
        filters,
        { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
        [...context.visibility],
        PAGE_SIZE,
      );
      return {
        kind: "internal",
        scopeLabel: context.scope.organizationWide
          ? "Organization"
          : "Authorized portfolio",
        filters,
        ...result,
      };
    }

    if (roles.has("CLIENT_USER")) {
      this.access.requireOrganization("VIEW_CLIENT_REPORTS");
      return { kind: "client" };
    }
    if (roles.has("LEADERSHIP")) {
      this.access.requireOrganization("VIEW_ORGANIZATION_ANALYTICS");
      return { kind: "leadership" };
    }
    if (roles.has("GUARD")) {
      const employeeId = context.scope.employeeId;
      if (!employeeId) return { kind: "denied" };
      this.access.require("VIEW_OWN_ASSIGNMENTS", {
        organizationId: context.organizationId,
        employeeId,
      });
      return { kind: "guard" };
    }
    return { kind: "denied" };
  }
}
