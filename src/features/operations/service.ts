import { AuthorizedDataAccess } from "@/server/request/boundary";
import type { OperationsRepository, OperationsScope } from "./repository";

export class OperationsService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: OperationsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private scope(): OperationsScope {
    const { context } = this.access;
    return { organizationId: context.organizationId, ...context.scope };
  }

  async listExceptions(limit = 25) {
    this.access.requireOrganization("VIEW_SITE_OPERATIONS");
    return this.repository.listExceptions(
      this.scope(),
      this.now().toISOString(),
      Math.min(Math.max(limit, 1), 100),
    );
  }
}
