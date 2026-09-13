import { AuthorizedDataAccess } from "@/server/request/boundary";
import { buildLeadershipDashboard } from "./dashboard";
import type {
  LeadershipDashboardFilters,
  LeadershipDashboardScope,
} from "./contracts";
import type { LeadershipDashboardRepository } from "./repository";

export class LeadershipDashboardService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: LeadershipDashboardRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private scope(): LeadershipDashboardScope {
    const context = this.access.context;
    return { organizationId: context.organizationId, ...context.scope };
  }

  async load(filters: LeadershipDashboardFilters = {}) {
    this.access.requireOrganization("VIEW_ORGANIZATION_ANALYTICS");
    const asOf = this.now();
    const window = {
      startsAt: new Date(asOf.valueOf() - 12 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(asOf.valueOf() + 12 * 60 * 60 * 1000).toISOString(),
      asOf: asOf.toISOString(),
    };
    const scope = this.scope();
    return buildLeadershipDashboard(
      await this.repository.load(scope, filters, window),
      window,
      scope.organizationWide,
      filters,
    );
  }
}
