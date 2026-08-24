import "server-only";

import { authorize, type ResourceScope } from "@/auth/authorization";
import type { Capability } from "@/domain/model";
import type { AuthenticatedRequestContext } from "./context";
import { PermissionDeniedError } from "./errors";

export type AuditContext = {
  actorUserId: string;
  organizationId: string;
  requestId: string;
  sessionId?: string;
};

export class AuthorizedDataAccess {
  constructor(readonly context: AuthenticatedRequestContext) {}

  require(capability: Capability, resource: ResourceScope): void {
    if (!this.context.capabilities.has(capability)) {
      throw new PermissionDeniedError();
    }

    const decision = authorize(this.context.actor, capability, resource);
    if (!decision.allowed) throw new PermissionDeniedError();
  }

  requireOrganization(capability: Capability): void {
    this.require(capability, { organizationId: this.context.organizationId });
  }

  requireAny(
    capabilities: readonly Capability[],
    resource: ResourceScope,
  ): void {
    if (
      !capabilities.some((capability) => {
        if (!this.context.capabilities.has(capability)) return false;
        return authorize(this.context.actor, capability, resource).allowed;
      })
    ) {
      throw new PermissionDeniedError();
    }
  }

  requireHierarchical(capability: Capability, resource: ResourceScope): void {
    this.requireAnyHierarchical([capability], resource);
  }

  requireAnyHierarchical(
    capabilities: readonly Capability[],
    resource: ResourceScope,
  ): void {
    const scope = this.context.scope;
    const authorizedResource = scope.organizationWide
      ? { organizationId: resource.organizationId }
      : resource.siteId && scope.siteIds.includes(resource.siteId)
        ? { organizationId: resource.organizationId, siteId: resource.siteId }
        : resource.clientId && scope.clientIds.includes(resource.clientId)
          ? {
              organizationId: resource.organizationId,
              clientId: resource.clientId,
            }
          : resource.branchId && scope.branchIds.includes(resource.branchId)
            ? {
                organizationId: resource.organizationId,
                branchId: resource.branchId,
              }
            : resource;
    this.requireAny(capabilities, authorizedResource);
  }

  auditContext(): AuditContext {
    return {
      actorUserId: this.context.actor.userId,
      organizationId: this.context.organizationId,
      requestId: this.context.request.id,
      sessionId: this.context.authentication.sessionId,
    };
  }
}
