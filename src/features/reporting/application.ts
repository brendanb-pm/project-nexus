import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { ReportingPageState } from "./contracts";
import type { ReportingService } from "./service";
export async function loadReportingPage(
  serviceOrPromise: ReportingService | Promise<ReportingService>,
): Promise<ReportingPageState> {
  try {
    const service = await serviceOrPromise;
    const [assignments, recent] = await Promise.all([
      service.listOwnAssignments(),
      service.listOwnRecent(),
    ]);
    return { kind: "ready", assignments, recent };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError ||
      error instanceof ResourceNotFoundError
    )
      return {
        kind: "permission-denied",
        message: "Your reporting workspace is unavailable for this account.",
      };
    return {
      kind: "error",
      message:
        "Reporting is temporarily unavailable. Your entry was not submitted; you can safely try again.",
      retryable: true,
    };
  }
}
