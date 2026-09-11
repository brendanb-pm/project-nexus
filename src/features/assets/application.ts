import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { AssetPageState } from "./contracts";
import type { AssetService } from "./service";
export async function loadAssetPage(
  serviceOrPromise: AssetService | Promise<AssetService>,
  selected?: string,
  createNew = false,
): Promise<AssetPageState> {
  try {
    const service = await serviceOrPromise;
    const [assets, sites, employees] = await Promise.all([
      service.list(),
      service.listSites(),
      service.listEmployees(),
    ]);
    const id = createNew ? undefined : (selected ?? assets[0]?.id);
    return {
      kind: "ready",
      assets,
      sites,
      employees,
      detail: id ? await service.detail(id) : undefined,
      canManage: service.canManage(),
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      return {
        kind: "permission-denied",
        message: "You do not have permission to manage asset inventory.",
      };
    if (error instanceof ResourceNotFoundError)
      return {
        kind: "error",
        message: "The selected asset is unavailable.",
        retryable: false,
      };
    return {
      kind: "error",
      message: "Asset inventory is temporarily unavailable.",
      retryable: true,
    };
  }
}
