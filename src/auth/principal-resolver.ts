import "server-only";

import { headers } from "next/headers";
import { getAuth } from "./server";
import { NEXUS_OIDC_PROVIDER_ID } from "./provider";
import {
  PostgresMembershipResolver,
  type ExternalSessionVerifier,
  type MembershipResolver,
  type VerifiedExternalSession,
} from "./membership";
import type {
  PrincipalResolver,
  ResolvedPrincipal,
} from "@/server/request/context";

export class NexusPrincipalResolver implements PrincipalResolver {
  private resolution?: Promise<ResolvedPrincipal | null>;

  constructor(
    private readonly sessionVerifier: ExternalSessionVerifier,
    private readonly membershipResolver: MembershipResolver,
  ) {}

  resolve(): Promise<ResolvedPrincipal | null> {
    this.resolution ??= this.resolveOnce();
    return this.resolution;
  }

  private async resolveOnce(): Promise<ResolvedPrincipal | null> {
    const session = await this.sessionVerifier.verify();
    if (!session) return null;
    const principal = await this.membershipResolver.resolve(session.authUserId);
    if (!principal) return null;

    return {
      principal,
      authentication: {
        sessionId: session.sessionId,
        authenticatedAt: session.authenticatedAt,
        provider: session.provider,
      },
    };
  }
}

export class BetterAuthSessionVerifier implements ExternalSessionVerifier {
  constructor(private readonly requestHeaders: Headers) {}

  async verify(): Promise<VerifiedExternalSession | null> {
    const result = await getAuth().api.getSession({
      headers: this.requestHeaders,
    });
    if (!result) return null;

    return {
      authUserId: result.user.id,
      sessionId: result.session.id,
      authenticatedAt: result.session.createdAt.toISOString(),
      provider: NEXUS_OIDC_PROVIDER_ID,
    };
  }
}

export async function createProductionPrincipalResolver(): Promise<NexusPrincipalResolver> {
  return new NexusPrincipalResolver(
    new BetterAuthSessionVerifier(await headers()),
    new PostgresMembershipResolver(),
  );
}
