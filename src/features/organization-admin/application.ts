import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { OrganizationAdminPageState } from "./contracts";
import type { OrganizationAdminService } from "./service";

export async function loadOrganizationAdminPage(
  serviceOrPromise:
    OrganizationAdminService | Promise<OrganizationAdminService>,
): Promise<OrganizationAdminPageState> {
  try {
    const service = await serviceOrPromise;
    const [organization, branches] = await Promise.all([
      service.getOrganization(),
      service.listBranches(),
    ]);
    return { kind: "ready", organization, branches };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    ) {
      return {
        kind: "permission-denied",
        message: "You do not have permission to manage this organization.",
      };
    }
    if (error instanceof ResourceNotFoundError) {
      return { kind: "error", message: error.message, retryable: false };
    }
    return {
      kind: "error",
      message: "Organization administration is temporarily unavailable.",
      retryable: true,
    };
  }
}
