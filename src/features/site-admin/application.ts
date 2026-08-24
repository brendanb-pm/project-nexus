import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { SiteAdminPageState } from "./contracts";
import type { SiteAdminService } from "./service";
export async function loadSiteAdminPage(
  serviceOrPromise: SiteAdminService | Promise<SiteAdminService>,
  selectedSiteId?: string,
): Promise<SiteAdminPageState> {
  try {
    const service = await serviceOrPromise;
    const [clients, sites] = await Promise.all([
      service.listClients(),
      service.listSites(),
    ]);
    const selected = selectedSiteId ?? sites.items[0]?.id;
    const detail = selected ? await service.getSiteDetail(selected) : undefined;
    return {
      kind: "ready",
      canManageSites: service.canManageSites(),
      canManagePosts: service.canManagePosts(),
      clients,
      sites,
      detail,
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      return {
        kind: "permission-denied",
        message: "You do not have permission to view site operations.",
      };
    if (error instanceof ResourceNotFoundError)
      return {
        kind: "error",
        message: "The selected site is unavailable.",
        retryable: false,
      };
    return {
      kind: "error",
      message: "Site administration is temporarily unavailable.",
      retryable: true,
    };
  }
}
