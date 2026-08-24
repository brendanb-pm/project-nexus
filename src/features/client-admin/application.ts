import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { ClientAdminPageState } from "./contracts";
import type { ClientAdminService } from "./service";

export async function loadClientAdminPage(
  serviceOrPromise: ClientAdminService | Promise<ClientAdminService>,
  selectedClientId?: string,
): Promise<ClientAdminPageState> {
  try {
    const service = await serviceOrPromise;
    const [branches, clients] = await Promise.all([
      service.listBranches(),
      service.listClients(),
    ]);
    const selected = selectedClientId ?? clients.items[0]?.id;
    const detail = selected
      ? await service.getClientDetail(selected)
      : undefined;
    return {
      kind: "ready",
      canMutate: service.canMutate(),
      branches,
      clients,
      detail,
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      return {
        kind: "permission-denied",
        message: "You do not have permission to view client administration.",
      };
    if (error instanceof ResourceNotFoundError)
      return {
        kind: "error",
        message: "The selected client is unavailable.",
        retryable: false,
      };
    return {
      kind: "error",
      message: "Client administration is temporarily unavailable.",
      retryable: true,
    };
  }
}
