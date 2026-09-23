import type { ReportingScope } from "@/features/reporting/repository";
import type { VisibilityClassification } from "@/domain/model";
import type {
  ReportHubFilters,
  ReportHubRow,
  ReportHubSite,
} from "./contracts";

export type ReportHubPage = {
  sites: readonly ReportHubSite[];
  sitesLimited: boolean;
  rows: readonly ReportHubRow[];
  hasMore: boolean;
  nextCursor?: string;
};

export interface ReportingHubRepository {
  list(
    scope: ReportingScope,
    filters: ReportHubFilters,
    window: { startsAt: string; endsAt: string },
    visibility: readonly VisibilityClassification[],
    limit: number,
  ): Promise<ReportHubPage>;
}
