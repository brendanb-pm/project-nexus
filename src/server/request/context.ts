import "server-only";

import { randomUUID } from "node:crypto";
import { resolveCapabilities, resolveVisibility } from "@/auth/authorization";
import type { Capability, VisibilityClassification } from "@/domain/model";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";
import { AuthenticationRequiredError } from "./errors";

export type AuthenticationMetadata = {
  sessionId?: string;
  authenticatedAt?: string;
  provider?: string;
};

export type ResolvedPrincipal = {
  principal: AuthenticatedPrincipal;
  authentication?: AuthenticationMetadata;
};

export interface PrincipalResolver {
  resolve(): Promise<ResolvedPrincipal | null>;
}

export type AuthenticatedRequestContext = {
  actor: AuthenticatedPrincipal;
  organizationId: string;
  scope: {
    organizationWide: boolean;
    branchIds: readonly string[];
    clientIds: readonly string[];
    siteIds: readonly string[];
    employeeId?: string;
  };
  capabilities: ReadonlySet<Capability>;
  visibility: ReadonlySet<VisibilityClassification>;
  request: {
    id: string;
    startedAt: string;
    operation: string;
  };
  authentication: AuthenticationMetadata;
};

export async function createAuthenticatedRequestContext(
  resolver: PrincipalResolver,
  operation: string,
  requestId: string = randomUUID(),
): Promise<AuthenticatedRequestContext> {
  const resolved = await resolver.resolve();
  if (!resolved) throw new AuthenticationRequiredError();

  const actor = resolved.principal;
  return {
    actor,
    organizationId: actor.organizationId,
    scope: {
      organizationWide: actor.organizationWide ?? false,
      branchIds: actor.branchIds,
      clientIds: actor.clientIds,
      siteIds: actor.siteIds,
      employeeId: actor.employeeId,
    },
    capabilities: resolveCapabilities(actor),
    visibility: resolveVisibility(actor),
    request: {
      id: requestId,
      startedAt: new Date().toISOString(),
      operation,
    },
    authentication: resolved.authentication ?? {},
  };
}
