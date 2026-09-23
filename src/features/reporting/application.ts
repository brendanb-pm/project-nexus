import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { ReportingPageState } from "./contracts";
import type { ReportingService } from "./service";
export async function loadReportingPage(
  serviceOrPromise: ReportingService | Promise<ReportingService>,
  assignmentId?: string,
): Promise<ReportingPageState> {
  try {
    const service = await serviceOrPromise;
    if (service.canReview()) {
      return {
        kind: "ready",
        assignments: [],
        recent: [],
        incidents: [],
        handoffs: [],
        reviewEnabled: true,
      };
    }
    try {
      const shiftReport = assignmentId
        ? await service.getOwnShiftReport(assignmentId)
        : await service.getOwnActiveShiftReport();
      return {
        kind: "ready",
        assignments: shiftReport.assignment ? [shiftReport.assignment] : [],
        recent: shiftReport.timeline,
        incidents: shiftReport.incidents,
        handoffs: [],
        timelineHasMore: shiftReport.timelineHasMore,
        reviewEnabled: service.canReview(),
      };
    } catch (error) {
      if (
        !(error instanceof ResourceNotFoundError) &&
        !(error instanceof PermissionDeniedError)
      )
        throw error;
      const [recent, incidents, handoffs] = await Promise.all([
        service.listAuthorizedActivities(),
        service.listAuthorizedIncidents(),
        service.listAuthorizedHandoffs(),
      ]);
      return {
        kind: "ready",
        assignments: [],
        recent,
        incidents,
        handoffs,
        reviewEnabled: service.canReview(),
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
