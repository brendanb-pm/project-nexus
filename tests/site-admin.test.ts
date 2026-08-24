import { describe, expect, it } from "vitest";
import {
  AuthorizedDataAccess,
  type AuditContext,
} from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import {
  InvariantViolationError,
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
} from "@/server/request/errors";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";
import { SiteAdminService } from "@/features/site-admin/service";
import type {
  PostMutation,
  SiteAdminRepository,
  SiteMutation,
  TrustedSiteScope,
} from "@/features/site-admin/repository";

class MemorySiteRepository implements SiteAdminRepository {
  sites = [
    {
      id: "site-1",
      clientId: "client-1",
      branchId: "branch-1",
      clientName: "Fictional Museum",
      name: "Museum",
      addressLine1: "1 Example Ave",
      city: "Portland",
      region: "OR",
      postalCode: "97201",
      country: "US",
      timezone: "America/Los_Angeles",
      status: "active" as const,
      updatedAt: "2026-08-23T00:00:00.000Z",
    },
  ];
  posts = [
    {
      id: "post-1",
      siteId: "site-1",
      name: "Front desk",
      description: "Staff the lobby",
      serviceType: "access_control" as const,
      armedRequirement: "unarmed" as const,
      qualificationRequirements: ["Site orientation"],
      status: "active" as const,
      updatedAt: "2026-08-23T00:00:00.000Z",
    },
  ];
  lastScope?: TrustedSiteScope;
  lastAudit?: AuditContext;
  calls: string[] = [];
  listClients(scope: TrustedSiteScope) {
    this.lastScope = scope;
    this.calls.push("listClients");
    return Promise.resolve([
      {
        id: "client-1",
        branchId: "branch-1",
        name: "Fictional Museum",
        branchName: "Central",
      },
    ]);
  }
  getClient(scope: TrustedSiteScope, id: string) {
    this.lastScope = scope;
    this.calls.push("getClient");
    return Promise.resolve(
      id === "client-1" &&
        (scope.organizationWide ||
          scope.clientIds.includes(id) ||
          scope.branchIds.includes("branch-1"))
        ? {
            id,
            branchId: "branch-1",
            name: "Fictional Museum",
            branchName: "Central",
          }
        : null,
    );
  }
  listSites(scope: TrustedSiteScope, limit: number) {
    this.lastScope = scope;
    this.calls.push("listSites");
    const allowed = this.sites.filter(
      (s) =>
        scope.organizationWide ||
        scope.clientIds.includes(s.clientId) ||
        scope.siteIds.includes(s.id),
    );
    return Promise.resolve({ items: allowed.slice(0, limit), hasMore: false });
  }
  getSite(scope: TrustedSiteScope, id: string) {
    this.lastScope = scope;
    this.calls.push("getSite");
    return Promise.resolve(
      this.sites.find(
        (s) =>
          s.id === id &&
          (scope.organizationWide ||
            scope.clientIds.includes(s.clientId) ||
            scope.siteIds.includes(s.id)),
      ) ?? null,
    );
  }
  async getSiteDetail(scope: TrustedSiteScope, id: string) {
    const site = await this.getSite(scope, id);
    return site
      ? { site, posts: this.posts.filter((p) => p.siteId === id) }
      : null;
  }
  createSite(
    scope: TrustedSiteScope,
    input: SiteMutation,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("createSite");
    return Promise.resolve({
      id: "site-2",
      branchId: "branch-1",
      clientName: "Fictional Museum",
      addressLine1: input.address.line1,
      city: input.address.city,
      region: input.address.region,
      postalCode: input.address.postalCode,
      country: input.address.country,
      updatedAt: "2026-08-23T01:00:00.000Z",
      ...input,
    });
  }
  updateSite(
    scope: TrustedSiteScope,
    id: string,
    input: SiteMutation,
    _expected: string,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("updateSite");
    const existing = this.sites.find((s) => s.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({
      id,
      branchId: existing.branchId,
      clientName: existing.clientName,
      addressLine1: input.address.line1,
      city: input.address.city,
      region: input.address.region,
      postalCode: input.address.postalCode,
      country: input.address.country,
      updatedAt: "2026-08-23T01:00:00.000Z",
      ...input,
    });
  }
  createPost(
    scope: TrustedSiteScope,
    input: PostMutation,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("createPost");
    return Promise.resolve({
      id: "post-2",
      updatedAt: "2026-08-23T01:00:00.000Z",
      ...input,
    });
  }
  updatePost(
    scope: TrustedSiteScope,
    id: string,
    input: PostMutation,
    _expected: string,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("updatePost");
    return Promise.resolve({
      id,
      updatedAt: "2026-08-23T01:00:00.000Z",
      ...input,
    });
  }
}
const principal = (
  roles: AuthenticatedPrincipal["roles"],
  scopes: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal => ({
  userId: "manager-1",
  organizationId: "org-1",
  roles,
  branchIds: [],
  clientIds: [],
  siteIds: [],
  ...scopes,
});
async function subject(
  actor: AuthenticatedPrincipal,
  repository = new MemorySiteRepository(),
) {
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: actor,
        authentication: { sessionId: "session-1" },
      }),
    },
    "site-admin.test",
    "request-1",
  );
  return {
    service: new SiteAdminService(
      new AuthorizedDataAccess(context),
      repository,
    ),
    repository,
  };
}
const siteInput = {
  clientId: "client-1",
  name: "Warehouse",
  addressLine1: "10 Test Way",
  city: "Portland",
  region: "OR",
  postalCode: "97201",
  country: "US",
  timezone: "America/Los_Angeles",
  latitude: "45.5",
  longitude: "-122.6",
  geofenceRadiusMeters: "100",
  status: "active",
};
describe("NX-1.3 site and post administration", () => {
  it("creates a tenant-scoped site with authoritative audit attribution", async () => {
    const { service, repository } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    await service.createSite(siteInput);
    expect(repository.lastScope?.organizationId).toBe("org-1");
    expect(repository.lastAudit).toMatchObject({
      actorUserId: "manager-1",
      requestId: "request-1",
    });
  });

  it("allows an operations manager only through an authoritative branch hierarchy", async () => {
    const { service, repository } = await subject(
      principal(["OPERATIONS_MANAGER"], { branchIds: ["branch-1"] }),
    );
    await service.createSite(siteInput);
    expect(repository.calls).toEqual(["getClient", "createSite"]);

    const outside = await subject(
      principal(["OPERATIONS_MANAGER"], { branchIds: ["branch-2"] }),
    );
    await expect(outside.service.createSite(siteInput)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });
  it("denies CLIENT_USER site and post mutations", async () => {
    const { service } = await subject(
      principal(["CLIENT_USER"], {
        clientIds: ["client-1"],
        siteIds: ["site-1"],
      }),
    );
    await expect(service.createSite(siteInput)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    await expect(
      service.createPost({
        siteId: "site-1",
        name: "Lobby",
        description: "Staff lobby",
        serviceType: "access_control",
        armedRequirement: "unarmed",
        qualificationRequirements: "",
        status: "active",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
  it("prevents site scope escape through a forged site hint", async () => {
    const { service } = await subject(
      principal(["OPERATIONS_MANAGER"], {
        clientIds: ["client-2"],
        siteIds: ["site-2"],
      }),
    );
    await expect(service.getSiteDetail("site-1")).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });
  it("prevents changing a site's authoritative client parent", async () => {
    const { service } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    await expect(
      service.updateSite({
        ...siteInput,
        clientId: "client-2",
        siteId: "site-1",
        expectedUpdatedAt: "2026-08-23T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError);
  });
  it("accepts only approved static service types and valid coordinates", async () => {
    const { service } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    await expect(
      service.createSite({ ...siteInput, latitude: "91" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.createPost({
        siteId: "site-1",
        name: "Rover",
        description: "Foot patrol within the site",
        serviceType: "vehicle_patrol",
        armedRequirement: "unarmed",
        qualificationRequirements: "",
        status: "active",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
  it("keeps Post as a first-class child and preserves qualification data", async () => {
    const { service } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    const post = await service.createPost({
      siteId: "site-1",
      name: "Command center",
      description: "Monitor access systems",
      serviceType: "site_security",
      armedRequirement: "either",
      qualificationRequirements: "Site orientation\nCCTV",
      status: "active",
    });
    expect(post).toMatchObject({
      siteId: "site-1",
      name: "Command center",
      qualificationRequirements: ["Site orientation", "CCTV"],
    });
  });
  it("uses bounded constant-query list operations", async () => {
    const { service, repository } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    await service.listSites();
    expect(repository.calls).toEqual(["listSites"]);
  });
});
