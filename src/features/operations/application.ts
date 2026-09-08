import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";
import type { OperationsService } from "./service";
import type { EndOfShiftReportService } from "@/features/eosr/service";

export type OperationsCenterState =
  | {
      kind: "ready";
      exceptions: Awaited<ReturnType<OperationsService["listExceptions"]>>;
      completedReports: Awaited<
        ReturnType<EndOfShiftReportService["listCompletedReports"]>
      >;
    }
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean };

export async function loadOperationsCenter(
  serviceOrPromise: OperationsService | Promise<OperationsService>,
  eosrServiceOrPromise:
    EndOfShiftReportService | Promise<EndOfShiftReportService>,
): Promise<OperationsCenterState> {
  try {
    const [service, eosrService] = await Promise.all([
      serviceOrPromise,
      eosrServiceOrPromise,
    ]);
    const [exceptions, completedReports] = await Promise.all([
      service.listExceptions(),
      eosrService.listCompletedReports(),
    ]);
    return {
      kind: "ready",
      exceptions,
      completedReports,
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
