import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  InvariantViolationError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import { validateActivity } from "./validation";
import type { CreateActivityInput } from "./contracts";
import type { ReportingRepository, ReportingScope } from "./repository";

export class ReportingService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: ReportingRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  private scope(): ReportingScope {
    const { context } = this.access;
    return { organizationId: context.organizationId, ...context.scope };
  }
  async listOwnAssignments() {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Employee relationship");
    this.access.require("VIEW_OWN_ASSIGNMENTS", {
      organizationId: this.access.context.organizationId,
      employeeId,
    });
    return this.repository.listOwnAssignments(this.scope(), employeeId, 25);
  }
  async listOwnRecent() {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Employee relationship");
    this.access.require("VIEW_OWN_ASSIGNMENTS", {
      organizationId: this.access.context.organizationId,
      employeeId,
    });
    return this.repository.listRecent(this.scope(), employeeId, 25);
  }
  async createActivity(raw: CreateActivityInput) {
    const input = validateActivity(raw);
    if (!input.shiftAssignmentId)
      throw new ResourceNotFoundError("Shift assignment");
    const context = await this.repository.getActivityContext(
      this.scope(),
      input.shiftAssignmentId,
    );
    if (!context) throw new ResourceNotFoundError("Shift assignment");
    this.access.requireHierarchical("CREATE_ACTIVITY_ENTRY", context);
    if (context.employeeId !== this.access.context.scope.employeeId)
      throw new PermissionDeniedError();
    if (context.assignmentStatus === "cancelled")
      throw new InvariantViolationError(
        "A cancelled assignment cannot receive activity entries.",
      );
    const occurredAt = this.now();
    if (
      occurredAt < new Date(context.scheduledStart) ||
      occurredAt > new Date(context.scheduledEnd)
    )
      throw new InvariantViolationError(
        "Activity entries can only be recorded during the current assignment.",
      );
    return this.repository.createActivity(
      this.scope(),
      context,
      { ...input, occurredAt: occurredAt.toISOString() },
      this.access.auditContext(),
    );
  }
}
