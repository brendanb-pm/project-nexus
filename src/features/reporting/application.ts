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
    try {
      const [assignments, recent, incidents, handoffs] = await Promise.all([
        service.listOwnAssignments(),
        service.listOwnRecent(),
        service.listOwnIncidents(),
        service.listOwnHandoffs(),
      ]);
      return { kind: "ready", assignments, recent, incidents, handoffs };
    } catch (error) {
      if (
        !(error instanceof ResourceNotFoundError) &&
        !(error instanceof PermissionDeniedError)
      )
        throw error;
      const incidents = await service.listAuthorizedIncidents();
      return {
        kind: "ready",
        assignments: [],
        recent: [],
        incidents,
        handoffs: [],
      };
    }
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
