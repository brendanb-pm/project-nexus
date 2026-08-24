import { describe, expect, it, vi } from "vitest";
import { authorize } from "@/auth/authorization";
import { NexusPrincipalResolver } from "@/auth/principal-resolver";
import type {
  ExternalSessionVerifier,
  MembershipResolver,
  VerifiedExternalSession,
} from "@/auth/membership";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthenticationRequiredError } from "@/server/request/errors";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";

const session: VerifiedExternalSession = {
  authUserId: "auth-user-1",
  sessionId: "session-1",
  authenticatedAt: "2026-08-23T12:00:00.000Z",
  provider: "nexus-oidc",
};

const member: AuthenticatedPrincipal = {
  userId: "00000000-0000-4000-8000-000000000050",
  employeeId: "00000000-0000-4000-8000-000000000060",
  organizationId: "00000000-0000-4000-8000-000000000001",
  roles: ["GUARD"],
  branchIds: ["00000000-0000-4000-8000-000000000010"],
  clientIds: [],
  siteIds: ["00000000-0000-4000-8000-000000000030"],
};

function resolver(
  verifiedSession: VerifiedExternalSession | null,
  resolvedMember: AuthenticatedPrincipal | null,
): {
  resolver: NexusPrincipalResolver;
  sessions: ExternalSessionVerifier;
  memberships: MembershipResolver;
} {
  const sessions = { verify: vi.fn().mockResolvedValue(verifiedSession) };
  const memberships = { resolve: vi.fn().mockResolvedValue(resolvedMember) };
  return {
    resolver: new NexusPrincipalResolver(sessions, memberships),
    sessions,
    memberships,
  };
}

describe("production identity and membership boundary", () => {
  it("denies a request with no valid provider session", async () => {
    const subject = resolver(null, member);
    await expect(
      createAuthenticatedRequestContext(subject.resolver, "test"),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(subject.memberships.resolve).not.toHaveBeenCalled();
  });

  it.each(["unknown identity", "inactive user", "inactive membership"])(
    "denies an %s when authoritative membership resolution fails",
    async () => {
      const subject = resolver(session, null);
      await expect(
        createAuthenticatedRequestContext(subject.resolver, "test"),
      ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    },
  );

  it("uses only database-resolved roles and scope", async () => {
    const subject = resolver(session, member);
    const context = await createAuthenticatedRequestContext(
      subject.resolver,
      "test",
    );

    expect(context.capabilities.has("MANAGE_ORGANIZATION")).toBe(false);
    expect(context.scope.organizationWide).toBe(false);
    expect(
      authorize(context.actor, "VIEW_OWN_ASSIGNMENTS", {
        organizationId: member.organizationId,
        employeeId: member.employeeId,
      }),
    ).toEqual({ allowed: true });
    expect(
      authorize(context.actor, "VIEW_OWN_ASSIGNMENTS", {
        organizationId: "00000000-0000-4000-8000-000000000002",
        employeeId: member.employeeId,
      }),
    ).toEqual({ allowed: false, reason: "organization-scope" });
  });

  it("attributes audit identity to the internal Nexus user", async () => {
    const subject = resolver(session, member);
    const context = await createAuthenticatedRequestContext(
      subject.resolver,
      "test",
    );
    expect(context.actor.userId).toBe(member.userId);
    expect(context.authentication.sessionId).toBe(session.sessionId);
    expect(context.authentication.provider).toBe(session.provider);
  });

  it("resolves session and membership only once per request context", async () => {
    const subject = resolver(session, member);
    await Promise.all([subject.resolver.resolve(), subject.resolver.resolve()]);
    expect(subject.sessions.verify).toHaveBeenCalledTimes(1);
    expect(subject.memberships.resolve).toHaveBeenCalledTimes(1);
  });

  it("fails a new request after membership is revoked", async () => {
    const active = resolver(session, member);
    await expect(active.resolver.resolve()).resolves.not.toBeNull();

    const revoked = resolver(session, null);
    await expect(revoked.resolver.resolve()).resolves.toBeNull();
  });
});
