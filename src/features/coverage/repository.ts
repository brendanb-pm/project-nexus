import type { AuditContext } from "@/server/request/boundary";
import type { SchedulingScope } from "@/features/scheduling/repository";
import type { CoverageGap, CoverageRequirement } from "./contracts";

export interface CoverageRepository {
  getPostScope(scope: SchedulingScope, postId: string): Promise<(Pick<CoverageRequirement, "postId" | "siteId" | "clientId" | "branchId" | "timezone"> & { organizationId: string }) | null>;
  listRequirements(scope: SchedulingScope, limit: number): Promise<readonly CoverageRequirement[]>;
  createRequirement(scope: SchedulingScope, input: Pick<CoverageRequirement, "postId" | "requiredCount" | "weekdays" | "localStartTime" | "localEndTime" | "effectiveStart" | "effectiveEnd">, audit: AuditContext): Promise<CoverageRequirement>;
  listGaps(scope: SchedulingScope, startsAt: string, endsAt: string, limit: number): Promise<readonly CoverageGap[]>;
}
