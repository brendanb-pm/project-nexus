import { describe, expect, it } from "vitest";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type PrincipalResolver,
} from "@/server/request/context";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";

const admin: AuthenticatedPrincipal = {
  userId: "user-admin",
  organizationId: "org-1",
  roles: ["ADMIN"],
  branchIds: ["branch-1"],
  clientIds: [],
  siteIds: [],
};

const resolver = (
  principal: AuthenticatedPrincipal | null,
): PrincipalResolver => ({
  resolve: async () =>
    principal
      ? {
          principal,
          authentication: { sessionId: "session-1", provider: "test" },
        }
      : null,
});

describe("authenticated request and data-access boundary", () => {
  it("fails closed when no principal can be resolved", async () => {
    await expect(
      createAuthenticatedRequestContext(resolver(null), "organization.list"),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it("carries authoritative actor, scopes, capabilities, visibility, and correlation", async () => {
    const context = await createAuthenticatedRequestContext(
      resolver(admin),
      "organization.list",
      "request-1",
    );
    expect(context).toMatchObject({
      actor: admin,
      organizationId: "org-1",
      scope: { branchIds: ["branch-1"] },
      request: { id: "request-1", operation: "organization.list" },
      authentication: { sessionId: "session-1", provider: "test" },
    });
    expect(context.capabilities).toEqual(
      expect.objectContaining({ has: expect.any(Function) }),
    );
    expect(context.capabilities.has("MANAGE_BRANCHES")).toBe(true);
    expect(context.visibility.has("RESTRICTED")).toBe(true);
  });

  it("denies a client-supplied cross-organization target", async () => {
    const context = await createAuthenticatedRequestContext(
      resolver(admin),
      "branch.update",
    );
    const access = new AuthorizedDataAccess(context);
    expect(() =>
      access.require("MANAGE_BRANCHES", { organizationId: "org-2" }),
    ).toThrow(PermissionDeniedError);
  });

  it("exposes immutable audit attribution from the authenticated context", async () => {
    const context = await createAuthenticatedRequestContext(
      resolver(admin),
      "branch.create",
      "request-2",
    );
    expect(new AuthorizedDataAccess(context).auditContext()).toEqual({
      actorUserId: "user-admin",
      organizationId: "org-1",
      requestId: "request-2",
      sessionId: "session-1",
    });
  });
});
