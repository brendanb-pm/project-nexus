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

  auditContext(): AuditContext {
    return {
      actorUserId: this.context.actor.userId,
      organizationId: this.context.organizationId,
      requestId: this.context.request.id,
      sessionId: this.context.authentication.sessionId,
    };
  }
}
