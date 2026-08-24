import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  InvariantViolationError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type {
  CreatePostInput,
  CreateSiteInput,
  UpdatePostInput,
  UpdateSiteInput,
} from "./contracts";
import {
  SITE_PAGE_SIZE,
  type SiteAdminRepository,
  type TrustedSiteScope,
} from "./repository";
import { validatePost, validateSite, validateVersion } from "./validation";
export class SiteAdminService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: SiteAdminRepository,
  ) {}
  private scope(): TrustedSiteScope {
    const c = this.access.context;
    return {
      organizationId: c.organizationId,
      organizationWide: c.scope.organizationWide,
      branchIds: c.scope.branchIds,
      clientIds: c.scope.clientIds,
      siteIds: c.scope.siteIds,
    };
  }
  private read(clientId?: string, siteId?: string) {
    this.access.requireAnyHierarchical(
      ["VIEW_SITE_OPERATIONS", "MANAGE_SITES", "MANAGE_POSTS"],
      { organizationId: this.access.context.organizationId, clientId, siteId },
    );
  }
  async listClients() {
    this.read();
    return this.repository.listClients(this.scope());
  }
  async listSites() {
    this.read();
    return this.repository.listSites(this.scope(), SITE_PAGE_SIZE);
  }
  async getSiteDetail(siteId: string) {
    this.read();
    const detail = await this.repository.getSiteDetail(this.scope(), siteId);
    if (!detail) throw new ResourceNotFoundError("Site");
    this.access.requireAnyHierarchical(
      ["VIEW_SITE_OPERATIONS", "MANAGE_SITES", "MANAGE_POSTS"],
      {
        organizationId: this.access.context.organizationId,
        branchId: detail.site.branchId,
        clientId: detail.site.clientId,
        siteId: detail.site.id,
      },
    );
    return detail;
  }
  canManageSites() {
    return this.access.context.capabilities.has("MANAGE_SITES");
  }
  canManagePosts() {
    return this.access.context.capabilities.has("MANAGE_POSTS");
  }
  async createSite(input: CreateSiteInput) {
    const value = validateSite(input);
    const client = await this.repository.getClient(
      this.scope(),
      value.clientId,
    );
    if (!client) throw new ResourceNotFoundError("Client");
    this.access.requireHierarchical("MANAGE_SITES", {
      organizationId: this.access.context.organizationId,
      branchId: client.branchId,
      clientId: client.id,
    });
    return this.repository.createSite(
      this.scope(),
      value,
      this.access.auditContext(),
    );
  }
  async updateSite(input: UpdateSiteInput) {
    const value = validateSite(input);
    const id = typeof input.siteId === "string" ? input.siteId : "";
    const existing = await this.repository.getSite(this.scope(), id);
    if (!existing) throw new ResourceNotFoundError("Site");
    this.access.requireHierarchical("MANAGE_SITES", {
      organizationId: this.access.context.organizationId,
      branchId: existing.branchId,
      clientId: existing.clientId,
      siteId: existing.id,
    });
    if (value.clientId !== existing.clientId)
      throw new InvariantViolationError(
        "A site's client relationship cannot be changed.",
      );
    const result = await this.repository.updateSite(
      this.scope(),
      id,
      value,
      validateVersion(input.expectedUpdatedAt),
      this.access.auditContext(),
    );
    if (!result) throw new ResourceNotFoundError("Site");
    return result;
  }
  async createPost(input: CreatePostInput) {
    const value = validatePost(input);
    const site = await this.repository.getSite(this.scope(), value.siteId);
    if (!site) throw new ResourceNotFoundError("Site");
    this.access.requireHierarchical("MANAGE_POSTS", {
      organizationId: this.access.context.organizationId,
      branchId: site.branchId,
      clientId: site.clientId,
      siteId: site.id,
    });
    return this.repository.createPost(
      this.scope(),
      value,
      this.access.auditContext(),
    );
  }
  async updatePost(input: UpdatePostInput) {
    const value = validatePost(input);
    const site = await this.repository.getSite(this.scope(), value.siteId);
    if (!site) throw new ResourceNotFoundError("Site");
    this.access.requireHierarchical("MANAGE_POSTS", {
      organizationId: this.access.context.organizationId,
      branchId: site.branchId,
      clientId: site.clientId,
      siteId: site.id,
    });
    const result = await this.repository.updatePost(
      this.scope(),
      typeof input.postId === "string" ? input.postId : "",
      value,
      validateVersion(input.expectedUpdatedAt),
      this.access.auditContext(),
    );
    if (!result) throw new ResourceNotFoundError("Post");
    return result;
  }
}
