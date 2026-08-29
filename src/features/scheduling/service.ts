import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  InvariantViolationError,
  ResourceNotFoundError,
  StaleUpdateError,
} from "@/server/request/errors";
import type { ShiftMutationInput, UpdateShiftInput } from "./contracts";
import type { SchedulingRepository, SchedulingScope } from "./repository";
import { validateShift } from "./validation";

const transitions = {
  DRAFT: new Set(["DRAFT", "PUBLISHED", "CANCELLED"]),
  PUBLISHED: new Set(["PUBLISHED", "COMPLETED", "CANCELLED"]),
  COMPLETED: new Set(["COMPLETED"]),
  CANCELLED: new Set(["CANCELLED"]),
} as const;

export class SchedulingService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: SchedulingRepository,
  ) {}

  private scope(): SchedulingScope {
    const { context } = this.access;
    return { organizationId: context.organizationId, ...context.scope };
  }

  async listShifts(limit = 25) {
    this.access.requireOrganization("VIEW_SITE_OPERATIONS");
    return this.repository.listShifts(
      this.scope(),
      Math.min(Math.max(limit, 1), 100),
    );
  }

  async createShift(raw: ShiftMutationInput) {
    const input = validateShift(raw);
    const scope = this.scope();
    const post = await this.repository.getPostScope(scope, input.postId);
    if (!post) throw new ResourceNotFoundError("Post");
    this.access.requireHierarchical("MANAGE_SHIFT_ASSIGNMENTS", post);
    if (post.timezone !== input.timezone) {
      throw new InvariantViolationError(
        "Shift timezone must match the authoritative site timezone.",
      );
    }
    return this.repository.createShift(
      scope,
      input,
      this.access.auditContext(),
    );
  }

  async updateShift(raw: UpdateShiftInput) {
    const shiftId = typeof raw.shiftId === "string" ? raw.shiftId : "";
    const expected =
      typeof raw.expectedUpdatedAt === "string" ? raw.expectedUpdatedAt : "";
    const input = validateShift(raw);
    const scope = this.scope();
    const current = await this.repository.getShift(scope, shiftId);
    if (!current) throw new ResourceNotFoundError("Shift");
    this.access.requireHierarchical("MANAGE_SHIFT_ASSIGNMENTS", current);
    if (
      input.postId !== current.postId ||
      input.timezone !== current.timezone
    ) {
      throw new InvariantViolationError(
        "A shift's authoritative post and timezone cannot be changed.",
      );
    }
    if (!transitions[current.status].has(input.status as never)) {
      throw new InvariantViolationError(
        `Shift cannot transition from ${current.status} to ${input.status}.`,
      );
    }
    const materiallyChanged =
      input.scheduledStart !== current.scheduledStart ||
      input.scheduledEnd !== current.scheduledEnd ||
      input.staffingRequirement !== current.staffingRequirement ||
      input.status === "CANCELLED";
    if (
      materiallyChanged &&
      (await this.repository.countActiveAssignments(scope, shiftId)) > 0
    ) {
      throw new InvariantViolationError(
        "Remove active assignments before cancelling or materially changing this shift.",
      );
    }
    const updated = await this.repository.updateShift(
      scope,
      shiftId,
      input,
      expected,
      this.access.auditContext(),
    );
    if (!updated) throw new StaleUpdateError();
    return updated;
  }
}
