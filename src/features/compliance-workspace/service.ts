import { AuthorizedDataAccess } from "@/server/request/boundary";
import { buildComplianceWorkspace } from "./workspace";
import type {
  ComplianceWorkspaceRepository,
  ComplianceWorkspaceScope,
} from "./repository";

export class ComplianceWorkspaceService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: ComplianceWorkspaceRepository,
  ) {}

  private scope(): ComplianceWorkspaceScope {
    const context = this.access.context;
    return {
      organizationId: context.organizationId,
      organizationWide: context.scope.organizationWide,
      branchIds: context.scope.branchIds,
      clientIds: context.scope.clientIds,
      siteIds: context.scope.siteIds,
    };
  }

  async list(now = new Date()) {
    this.access.requireOrganization("VIEW_EMPLOYEE_COMPLIANCE");
    return buildComplianceWorkspace(
      await this.repository.load(this.scope(), now.toISOString()),
      now,
    );
  }
}
