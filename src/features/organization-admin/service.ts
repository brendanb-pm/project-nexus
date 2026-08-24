import { AuthorizedDataAccess } from "@/server/request/boundary";
import { ResourceNotFoundError } from "@/server/request/errors";
import type {
  BranchCursor,
  CreateBranchInput,
  UpdateBranchInput,
  UpdateOrganizationInput,
} from "./contracts";
import {
  boundedPageSize,
  type OrganizationAdminRepository,
} from "./repository";
import {
  validateCreateBranchInput,
  validateOrganizationInput,
  validateUpdateBranchInput,
} from "./validation";

export class OrganizationAdminService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: OrganizationAdminRepository,
  ) {}

  async getOrganization() {
    this.access.requireOrganization("MANAGE_ORGANIZATION");
    const result = await this.repository.getOrganization(
      this.access.context.organizationId,
    );
    if (!result) throw new ResourceNotFoundError("Organization");
    return result;
  }

  async updateOrganization(input: UpdateOrganizationInput) {
    this.access.requireOrganization("MANAGE_ORGANIZATION");
    const validated = validateOrganizationInput(input);
    const { expectedUpdatedAt, ...mutation } = validated;
    const result = await this.repository.updateOrganization(
      this.access.context.organizationId,
      mutation,
      expectedUpdatedAt,
      this.access.auditContext(),
    );
    if (!result) throw new ResourceNotFoundError("Organization");
    return result;
  }

  async listBranches(options: { limit?: number; cursor?: BranchCursor } = {}) {
    this.access.requireOrganization("MANAGE_BRANCHES");
    return this.repository.listBranches(this.access.context.organizationId, {
      limit: boundedPageSize(options.limit),
      cursor: options.cursor,
    });
  }

  async getBranch(branchId: string) {
    this.access.requireOrganization("MANAGE_BRANCHES");
    const result = await this.repository.getBranch(
      this.access.context.organizationId,
      branchId,
    );
    if (!result) throw new ResourceNotFoundError("Branch");
    return result;
  }

  async createBranch(input: CreateBranchInput) {
    this.access.requireOrganization("MANAGE_BRANCHES");
    return this.repository.createBranch(
      this.access.context.organizationId,
      validateCreateBranchInput(input),
      this.access.auditContext(),
    );
  }

  async updateBranch(input: UpdateBranchInput) {
    this.access.requireOrganization("MANAGE_BRANCHES");
    const validated = validateUpdateBranchInput(input);
    const { branchId, expectedUpdatedAt, ...mutation } = validated;
    const result = await this.repository.updateBranch(
      this.access.context.organizationId,
      branchId,
      mutation,
      expectedUpdatedAt,
      this.access.auditContext(),
    );
    if (!result) throw new ResourceNotFoundError("Branch");
    return result;
  }
}
