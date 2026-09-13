import type { Capability } from "@/domain/model";

export function selectAuthenticatedLandingPath(
  capabilities: ReadonlySet<Capability>,
): string | null {
  if (capabilities.has("VIEW_OWN_ASSIGNMENTS")) return "/home";
  if (capabilities.has("VIEW_ORGANIZATION_ANALYTICS")) return "/leadership";
  if (capabilities.has("VIEW_SITE_OPERATIONS")) return "/operations";
  if (
    capabilities.has("VIEW_CLIENT_REPORTS") ||
    capabilities.has("VIEW_CLIENT_INCIDENTS")
  )
    return "/portal";
  return null;
}
