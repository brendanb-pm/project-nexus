import { AuthorizedDataAccess } from "@/server/request/boundary";
import type { AnalyticsFilters, AnalyticsScope } from "./contracts";
import { buildReportingAnalytics } from "./rollup";
import type { PostgresReportingAnalyticsRepository } from "./postgres-repository";

export class ReportingAnalyticsService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: Pick<
      PostgresReportingAnalyticsRepository,
      "load"
    >,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async load(filters: AnalyticsFilters) {
    this.access.requireAny(
      ["VIEW_SITE_OPERATIONS", "VIEW_ORGANIZATION_ANALYTICS"],
      { organizationId: this.access.context.organizationId },
    );
    const scope: AnalyticsScope = {
      organizationId: this.access.context.organizationId,
      ...this.access.context.scope,
    };
    const asOf = this.now();
    const window = {
      startsAt: new Date(
        asOf.valueOf() - filters.windowHours * 60 * 60 * 1000,
      ).toISOString(),
      endsAt: asOf.toISOString(),
      asOf: asOf.toISOString(),
      timezone: "UTC" as const,
    };
    return buildReportingAnalytics(
      await this.repository.load(scope, filters, window),
      scope.organizationWide,
      filters,
      window,
    );
  }
}
