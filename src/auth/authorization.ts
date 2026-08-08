import type { AuthenticatedPrincipal, Role } from "@/shared/types/auth";

export function hasRole(
  principal: AuthenticatedPrincipal,
  role: Role,
): boolean {
  return principal.roles.includes(role);
}

export function belongsToTenant(
  principal: AuthenticatedPrincipal,
  tenantId: string,
): boolean {
  return principal.tenantId === tenantId;
}
