export const roles = [
  "administrator",
  "operations_manager",
  "supervisor",
  "officer",
  "client",
] as const;
export type Role = (typeof roles)[number];
export type AuthenticatedPrincipal = {
  userId: string;
  tenantId: string;
  roles: readonly Role[];
};
