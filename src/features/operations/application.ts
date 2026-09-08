import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";
import type { OperationsService } from "./service";
import type { EndOfShiftReportService } from "@/features/eosr/service";
import type { ReportingService } from "@/features/reporting/service";
import { buildOperationsRecordWorkflow } from "./record-workflow";

export type OperationsCenterState =
  | {
      kind: "ready";
      exceptions: Awaited<ReturnType<OperationsService["listExceptions"]>>;
      scorecards: Awaited<ReturnType<OperationsService["listScorecards"]>>;
      recordWorkflow: ReturnType<typeof buildOperationsRecordWorkflow>;
    }
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean };

export async function loadOperationsCenter(
  serviceOrPromise: OperationsService | Promise<OperationsService>,
  eosrServiceOrPromise:
    EndOfShiftReportService | Promise<EndOfShiftReportService>,
  reportingServiceOrPromise: ReportingService | Promise<ReportingService>,
): Promise<OperationsCenterState> {
  try {
    const [service, eosrService, reportingService] = await Promise.all([
      serviceOrPromise,
      eosrServiceOrPromise,
      reportingServiceOrPromise,
    ]);
    const [
      exceptions,
      scorecards,
      completedReports,
      activities,
      incidents,
      handoffs,
    ] = await Promise.all([
      service.listExceptions(),
      service.listScorecards(),
      eosrService.listCompletedReports(),
      reportingService.listAuthorizedActivities(),
      reportingService.listAuthorizedIncidents(),
      reportingService.listAuthorizedHandoffs(),
    ]);
    return {
      kind: "ready",
      exceptions,
      scorecards,
      recordWorkflow: buildOperationsRecordWorkflow({
        activities,
        incidents,
        reports: completedReports,
        handoffs,
      }),
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      return {
        kind: "permission-denied",
        message: "You do not have permission to review operations exceptions.",
      };
    return {
      kind: "error",
      message: "Operations Center is temporarily unavailable.",
      retryable: true,
    };
  }
}
