import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";
import type {
  LeadershipDashboardFilters,
  LeadershipDashboardPageState,
} from "./contracts";
import type { LeadershipDashboardService } from "./service";

export async function loadLeadershipDashboard(
  serviceOrPromise:
    LeadershipDashboardService | Promise<LeadershipDashboardService>,
  filters: LeadershipDashboardFilters,
): Promise<LeadershipDashboardPageState> {
  try {
    return {
      kind: "ready",
      dashboard: await (await serviceOrPromise).load(filters),
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      return {
        kind: "permission-denied",
        message: "You do not have permission to view leadership operations.",
      };
    return {
      kind: "error",
      message: "Leadership operations are temporarily unavailable.",
      retryable: true,
    };
  }
}
