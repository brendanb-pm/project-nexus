import { describe, expect, it } from "vitest";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { PermissionDeniedError } from "@/server/request/errors";
import { OperationsService } from "@/features/operations/service";
import type { OperationsRepository } from "@/features/operations/repository";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";

const principal = (
  role: AuthenticatedPrincipal["roles"][number],
): AuthenticatedPrincipal => ({
  userId: `user-${role}`,
  organizationId: "org-1",
  roles: [role],
  organizationWide: true,
  branchIds: [],
  clientIds: [],
  siteIds: [],
});
const repository: OperationsRepository = {
  listExceptions: async () => ({ items: [], hasMore: false }),
};

async function service(role: AuthenticatedPrincipal["roles"][number]) {
  const context = await createAuthenticatedRequestContext(
    { resolve: async () => ({ principal: principal(role) }) },
    "operations.test",
  );
  return new OperationsService(
    new AuthorizedDataAccess(context),
    repository,
    () => new Date("2026-09-01T00:00:00.000Z"),
  );
}

describe("operations exception boundary", () => {
  it("allows Operations Manager through the canonical site-operations capability", async () => {
    await expect(
      (await service("OPERATIONS_MANAGER")).listExceptions(),
    ).resolves.toEqual({ items: [], hasMore: false });
  });
  it("denies Guard and Client User operations reads", async () => {
    await expect(
      (await service("GUARD")).listExceptions(),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      (await service("CLIENT_USER")).listExceptions(),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
