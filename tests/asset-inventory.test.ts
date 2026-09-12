import { describe, expect, it } from "vitest";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { AssetService } from "@/features/assets/service";
import type { AssetRepository } from "@/features/assets/repository";
import {
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";
const asset = {
  id: "asset-1",
  identifier: "RADIO-101",
  assetType: "radio" as const,
  status: "active" as const,
  condition: "good" as const,
  siteId: "site-1",
  siteName: "North",
  clientName: "Client",
  updatedAt: "2026-09-11T00:00:00.000Z",
};
function repository(): AssetRepository {
  return {
    list: async () => [asset],
    listSites: async () => [
      {
        id: "site-1",
        name: "North",
        clientName: "Client",
        branchId: "branch-1",
      },
    ],
    listEmployees: async () => [
      { id: "employee-1", displayName: "Alex Guard", branchId: "branch-1" },
    ],
    get: async (_scope, id) => (id === asset.id ? asset : null),
    detail: async (_scope, id) =>
      id === asset.id ? { asset, audit: [], custody: [] } : null,
    create: async (_scope, input) =>
      ({
        ...asset,
        ...input,
        id: "asset-2",
        updatedAt: asset.updatedAt,
      }) as typeof asset,
    update: async (_scope, id, input) =>
      id === asset.id ? ({ ...asset, ...input } as typeof asset) : null,
    custody: async (_scope, id) => (id === asset.id ? asset : null),
  };
}
async function service(
  roles: AuthenticatedPrincipal["roles"],
  scope = {
    organizationWide: true,
    branchIds: [] as string[],
    clientIds: [] as string[],
    siteIds: [] as string[],
  },
) {
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: {
          userId: "user-1",
          organizationId: "org-1",
          roles,
          organizationWide: scope.organizationWide,
          branchIds: scope.branchIds,
          clientIds: scope.clientIds,
          siteIds: scope.siteIds,
        },
      }),
    },
    "asset.test",
  );
  return new AssetService(new AuthorizedDataAccess(context), repository());
}
describe("asset inventory", () => {
  it("allows an Operations Manager to create scoped inventory and preserves non-custody fields", async () => {
    const subject = await service(["OPERATIONS_MANAGER"]);
    const result = await subject.create({
      identifier: "VEH-1",
      assetType: "vehicle",
      status: "active",
      condition: "good",
      siteId: "site-1",
      inspectionDueOn: "2026-10-01",
      expiresOn: "",
    });
    expect(result.identifier).toBe("VEH-1");
    expect(result.assetType).toBe("vehicle");
  });
  it("denies guards and client users", async () => {
    await expect((await service(["GUARD"])).list()).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    await expect(
      (await service(["CLIENT_USER"])).list(),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
  it("does not accept a forged site outside the authoritative scope", async () => {
    const subject = await service(["OPERATIONS_MANAGER"], {
      organizationWide: false,
      branchIds: ["branch-1"],
      clientIds: [],
      siteIds: ["site-1"],
    });
    await expect(
      subject.create({
        identifier: "KEY-9",
        assetType: "keys",
        status: "active",
        condition: "good",
        siteId: "site-2",
        inspectionDueOn: "",
        expiresOn: "",
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
  it("rejects invalid canonical values and missing identifiers", async () => {
    const subject = await service(["ADMIN"]);
    await expect(
      subject.create({
        identifier: "",
        assetType: "made_up",
        status: "active",
        condition: "good",
        siteId: "site-1",
        inspectionDueOn: "",
        expiresOn: "",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
