import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";
import type { OperationsService } from "./service";

export type OperationsCenterState =
  | {
      kind: "ready";
      exceptions: Awaited<ReturnType<OperationsService["listExceptions"]>>;
    }
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean };

export async function loadOperationsCenter(
  serviceOrPromise: OperationsService | Promise<OperationsService>,
): Promise<OperationsCenterState> {
  try {
    return {
      kind: "ready",
      exceptions: await (await serviceOrPromise).listExceptions(),
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
