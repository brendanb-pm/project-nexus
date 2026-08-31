import { AuthorizedDataAccess } from "@/server/request/boundary";
import { InvariantViolationError } from "@/server/request/errors";
import type { SchedulingScope } from "@/features/scheduling/repository";
import type { CoverageRequirementInput } from "./contracts";
import type { CoverageRepository } from "./repository";
import { validateCoverageRequirement } from "./validation";

export class CoverageService {
  constructor(private readonly access: AuthorizedDataAccess, private readonly repository: CoverageRepository) {}
  private scope(): SchedulingScope { const { context } = this.access; return { organizationId: context.organizationId, ...context.scope }; }
  async listRequirements(limit = 25) { this.access.requireOrganization("VIEW_SITE_OPERATIONS"); return this.repository.listRequirements(this.scope(), Math.min(Math.max(limit, 1), 100)); }
  async createRequirement(raw: CoverageRequirementInput) {
    const input = validateCoverageRequirement(raw);
    const post = await this.repository.getPostScope(this.scope(), input.postId);
    if (!post) throw new InvariantViolationError("Post is outside the authorized scope.");
    this.access.requireHierarchical("MANAGE_SHIFT_ASSIGNMENTS", post);
    return this.repository.createRequirement(this.scope(), input, this.access.auditContext());
  }
  async listGaps(startsAt: string, endsAt: string, limit = 25) {
    this.access.requireOrganization("VIEW_SITE_OPERATIONS");
    if (!(new Date(endsAt) > new Date(startsAt))) throw new InvariantViolationError("Coverage window must have a positive duration.");
    return this.repository.listGaps(this.scope(), startsAt, endsAt, Math.min(Math.max(limit, 1), 100));
  }
}
