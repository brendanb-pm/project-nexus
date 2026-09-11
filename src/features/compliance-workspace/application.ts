import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";
import type { ComplianceWorkspacePageState } from "./contracts";
import type { ComplianceWorkspaceService } from "./service";

export async function loadComplianceWorkspace(
  serviceOrPromise:
    ComplianceWorkspaceService | Promise<ComplianceWorkspaceService>,
): Promise<ComplianceWorkspacePageState> {
  try {
    return { kind: "ready", workspace: await (await serviceOrPromise).list() };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      return {
        kind: "permission-denied",
        message: "You do not have permission to view Operations compliance.",
      };
    return {
      kind: "error",
      message: "Operations compliance is temporarily unavailable.",
      retryable: true,
    };
  }
}
