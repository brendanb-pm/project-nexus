import "server-only";

import { cookies, headers } from "next/headers";
import { DEV_AUTH_COOKIE, verifyDevelopmentSession } from "./development";
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

export class DevelopmentSessionVerifier implements ExternalSessionVerifier {
  constructor(private readonly session: string | undefined) {}

  async verify(): Promise<VerifiedExternalSession | null> {
    const session = verifyDevelopmentSession(this.session);
    if (!session) return null;
    return {
      authUserId: session.authUserId,
      sessionId: `development:${session.persona}`,
      authenticatedAt: new Date().toISOString(),
      provider: NEXUS_OIDC_PROVIDER_ID,
    };
  }
}

export async function createProductionPrincipalResolver(): Promise<NexusPrincipalResolver> {
  const developmentSession = (await cookies()).get(DEV_AUTH_COOKIE)?.value;
  if (verifyDevelopmentSession(developmentSession)) {
    return new NexusPrincipalResolver(
      new DevelopmentSessionVerifier(developmentSession),
      new PostgresMembershipResolver(),
    );
  }
  return new NexusPrincipalResolver(
    new BetterAuthSessionVerifier(await headers()),
    new PostgresMembershipResolver(),
  );
}
