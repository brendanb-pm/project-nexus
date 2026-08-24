import type {
  Capability,
  Role,
  VisibilityClassification,
} from "@/domain/model";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";

export type ResourceScope = {
  organizationId: string;
  branchId?: string;
  clientId?: string;
  siteId?: string;
  employeeId?: string;
  visibility?: VisibilityClassification;
};
export type AuthorizationDecision =
  { allowed: true } | { allowed: false; reason: string };

export const roleCapabilities: Readonly<Record<Role, ReadonlySet<Capability>>> =
  {
    GUARD: new Set([
      "VIEW_OWN_ASSIGNMENTS",
      "CLOCK_OWN_SHIFT",
      "CREATE_ACTIVITY_ENTRY",
      "CREATE_INCIDENT",
      "SUBMIT_HANDOFF",
    ]),
    SUPERVISOR: new Set([
      "VIEW_SITE_OPERATIONS",
      "MANAGE_SHIFT_ASSIGNMENTS",
      "ACKNOWLEDGE_INCIDENT",
      "APPROVE_TIME",
      "VIEW_EMPLOYEE_COMPLIANCE",
    ]),
    OPERATIONS_MANAGER: new Set([
      "VIEW_SITE_OPERATIONS",
      "MANAGE_SHIFT_ASSIGNMENTS",
      "ACKNOWLEDGE_INCIDENT",
      "APPROVE_TIME",
      "VIEW_EMPLOYEE_COMPLIANCE",
      "MANAGE_CLIENTS",
      "MANAGE_SITES",
      "MANAGE_POSTS",
      "MANAGE_EMPLOYEES",
      "MANAGE_ASSETS",
    ]),
    CLIENT_USER: new Set(["VIEW_CLIENT_REPORTS", "VIEW_CLIENT_INCIDENTS"]),
    LEADERSHIP: new Set([
      "VIEW_ORGANIZATION_ANALYTICS",
      "VIEW_BILLING_DATA",
      "VIEW_CLIENT_REPORTS",
      "VIEW_CLIENT_INCIDENTS",
      "VIEW_SITE_OPERATIONS",
    ]),
    ADMIN: new Set([
      "VIEW_ORGANIZATION_ANALYTICS",
      "VIEW_BILLING_DATA",
      "MANAGE_ORGANIZATION",
      "MANAGE_BRANCHES",
      "MANAGE_CLIENTS",
      "MANAGE_SITES",
      "MANAGE_POSTS",
      "MANAGE_EMPLOYEES",
      "MANAGE_ASSETS",
      "MANAGE_ROLES",
      "VIEW_SITE_OPERATIONS",
      "MANAGE_SHIFT_ASSIGNMENTS",
      "ACKNOWLEDGE_INCIDENT",
      "APPROVE_TIME",
      "VIEW_EMPLOYEE_COMPLIANCE",
      "VIEW_CLIENT_REPORTS",
      "VIEW_CLIENT_INCIDENTS",
    ]),
  };

const permittedVisibility: Readonly<
  Record<Role, ReadonlySet<VisibilityClassification>>
> = {
  GUARD: new Set(["INTERNAL", "CLIENT_VISIBLE"]),
  SUPERVISOR: new Set(["INTERNAL", "SUPERVISOR", "CLIENT_VISIBLE"]),
  OPERATIONS_MANAGER: new Set(["INTERNAL", "SUPERVISOR", "CLIENT_VISIBLE"]),
  CLIENT_USER: new Set(["CLIENT_VISIBLE"]),
  LEADERSHIP: new Set([
    "INTERNAL",
    "SUPERVISOR",
    "CLIENT_VISIBLE",
    "EXECUTIVE",
    "RESTRICTED",
  ]),
  ADMIN: new Set([
    "INTERNAL",
    "SUPERVISOR",
    "CLIENT_VISIBLE",
    "EXECUTIVE",
    "RESTRICTED",
  ]),
};

export function resolveVisibility(
  actor: AuthenticatedPrincipal,
): ReadonlySet<VisibilityClassification> {
  return new Set(actor.roles.flatMap((role) => [...permittedVisibility[role]]));
}

export function hasCapability(
  actor: AuthenticatedPrincipal,
  capability: Capability,
): boolean {
  return actor.roles.some((role) => roleCapabilities[role].has(capability));
}

export function resolveCapabilities(
  actor: AuthenticatedPrincipal,
): ReadonlySet<Capability> {
  return new Set(actor.roles.flatMap((role) => [...roleCapabilities[role]]));
}

export function authorize(
  actor: AuthenticatedPrincipal,
  capability: Capability,
  resource: ResourceScope,
): AuthorizationDecision {
  if (!hasCapability(actor, capability))
    return { allowed: false, reason: "missing-capability" };
  if (actor.organizationId !== resource.organizationId)
    return { allowed: false, reason: "organization-scope" };
  if (resource.branchId && !actor.branchIds.includes(resource.branchId))
    return { allowed: false, reason: "branch-scope" };
  if (resource.clientId && !actor.clientIds.includes(resource.clientId))
    return { allowed: false, reason: "client-scope" };
  if (resource.siteId && !actor.siteIds.includes(resource.siteId))
    return { allowed: false, reason: "site-scope" };
  if (
    capability === "VIEW_OWN_ASSIGNMENTS" &&
    actor.employeeId !== resource.employeeId
  )
    return { allowed: false, reason: "employee-self-scope" };
  if (resource.visibility && !resolveVisibility(actor).has(resource.visibility))
    return { allowed: false, reason: "visibility" };
  return { allowed: true };
}
