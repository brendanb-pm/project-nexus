import type {
  LeadershipDashboardFilters,
  LeadershipDashboardScope,
  LeadershipDashboardSources,
} from "./contracts";

export interface LeadershipDashboardRepository {
  load(
    scope: LeadershipDashboardScope,
    filters: LeadershipDashboardFilters,
    window: { startsAt: string; endsAt: string; asOf: string },
  ): Promise<LeadershipDashboardSources>;
}
