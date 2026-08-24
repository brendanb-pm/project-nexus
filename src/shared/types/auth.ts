import type { Role } from "@/domain/model";

export type AuthenticatedPrincipal = {
  userId: string;
  employeeId?: string;
  organizationId: string;
  organizationWide?: boolean;
  roles: readonly Role[];
  branchIds: readonly string[];
  clientIds: readonly string[];
  siteIds: readonly string[];
};

export type { Role } from "@/domain/model";
