import { AuthorizedDataAccess } from "@/server/request/boundary";
import { ResourceNotFoundError } from "@/server/request/errors";
import type { CreateAssetInput, UpdateAssetInput } from "./contracts";
import type { AssetRepository, TrustedAssetScope } from "./repository";
import { validateAsset, validateVersion } from "./validation";
export class AssetService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: AssetRepository,
  ) {}
  private scope(): TrustedAssetScope {
    const c = this.access.context;
    return {
      organizationId: c.organizationId,
      organizationWide: c.scope.organizationWide,
      branchIds: c.scope.branchIds,
      clientIds: c.scope.clientIds,
      siteIds: c.scope.siteIds,
    };
  }
  private read() {
    this.access.requireOrganization("MANAGE_ASSETS");
  }
  canManage() {
    return this.access.context.capabilities.has("MANAGE_ASSETS");
  }
  async list() {
    this.read();
    return this.repository.list(this.scope());
  }
  async listSites() {
    this.read();
    return this.repository.listSites(this.scope());
  }
  async detail(id: string) {
    this.read();
    const detail = await this.repository.detail(this.scope(), id);
    if (!detail) throw new ResourceNotFoundError("Asset");
    return detail;
  }
  async create(input: CreateAssetInput) {
    this.read();
    const value = validateAsset(input);
    const sites = await this.repository.listSites(this.scope());
    if (!sites.some((site) => site.id === value.siteId))
      throw new ResourceNotFoundError("Inventory site");
    return this.repository.create(
      this.scope(),
      value,
      this.access.auditContext(),
    );
  }
  async update(input: UpdateAssetInput) {
    this.read();
    const value = validateAsset(input);
    const id = typeof input.assetId === "string" ? input.assetId : "";
    const existing = await this.repository.get(this.scope(), id);
    if (!existing) throw new ResourceNotFoundError("Asset");
    const sites = await this.repository.listSites(this.scope());
    if (!sites.some((site) => site.id === value.siteId))
      throw new ResourceNotFoundError("Inventory site");
    const result = await this.repository.update(
      this.scope(),
      id,
      value,
      validateVersion(input.expectedUpdatedAt),
      this.access.auditContext(),
    );
    if (!result) throw new ResourceNotFoundError("Asset");
    return result;
  }
}
