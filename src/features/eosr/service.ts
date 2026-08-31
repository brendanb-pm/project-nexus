import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  InvariantViolationError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { CreateEndOfShiftReportInput } from "./contracts";
import type { EndOfShiftReportRepository } from "./repository";
import { validateEndOfShiftReport } from "./validation";

export class EndOfShiftReportService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: EndOfShiftReportRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  private scope() {
    const { context } = this.access;
    return { organizationId: context.organizationId, ...context.scope };
  }
  async submit(raw: CreateEndOfShiftReportInput) {
    const input = validateEndOfShiftReport(raw);
    const context = await this.repository.getAssignment(
      this.scope(),
      input.shiftAssignmentId,
    );
    if (!context) throw new ResourceNotFoundError("Shift assignment");
    this.access.requireHierarchical("SUBMIT_HANDOFF", {
      ...context,
      visibility: "INTERNAL",
    });
    if (context.employeeId !== this.access.context.scope.employeeId)
      throw new PermissionDeniedError();
    if (context.assignmentStatus === "cancelled")
      throw new InvariantViolationError(
        "A cancelled assignment cannot receive an end-of-shift report.",
      );
    const submittedAt = this.now();
    if (
      submittedAt < new Date(context.scheduledStart) ||
      submittedAt > new Date(context.scheduledEnd)
    )
      throw new InvariantViolationError(
        "End-of-shift reports can only be submitted during the assignment.",
      );
    return this.repository.create(
      this.scope(),
      context,
      {
        ...input,
        shiftAssignmentId: context.id,
        submittedByUserId: this.access.context.actor.userId,
      },
      this.access.auditContext(),
    );
  }
  async listIncomingPassdowns(limit = 25) {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Employee relationship");
    this.access.require("VIEW_OWN_ASSIGNMENTS", {
      organizationId: this.access.context.organizationId,
      employeeId,
    });
    return this.repository.listIncomingPassdowns(
      this.scope(),
      employeeId,
      this.access.context.actor.userId,
      Math.min(Math.max(limit, 1), 100),
    );
  }
  async dismissPassdown(id: string, dismissed: boolean) {
    const incoming = (await this.listIncomingPassdowns(100)).find(
      (item) => item.id === id,
    );
    if (!incoming) throw new ResourceNotFoundError("Passdown");
    return this.repository.setPassdownDismissal(
      this.scope(),
      incoming,
      this.access.context.actor.userId,
      dismissed,
      this.now().toISOString(),
      this.access.auditContext(),
    );
  }
  async listShiftClose(limit = 25) {
    this.access.requireOrganization("VIEW_SITE_OPERATIONS");
    return this.repository.listShiftClose(
      this.scope(),
      Math.min(Math.max(limit, 1), 100),
    );
  }
}
