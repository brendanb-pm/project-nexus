import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  InvariantViolationError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import {
  validateActivity,
  validateHandoff,
  validateIncident,
} from "./validation";
import type {
  CreateActivityInput,
  CreateHandoffInput,
  CreateIncidentInput,
} from "./contracts";
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
  async listOwnIncidents() {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Employee relationship");
    this.access.require("VIEW_OWN_ASSIGNMENTS", {
      organizationId: this.access.context.organizationId,
      employeeId,
    });
    return this.repository.listOwnIncidents(this.scope(), employeeId, 25);
  }
  async listOwnHandoffs() {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Employee relationship");
    this.access.require("VIEW_OWN_ASSIGNMENTS", {
      organizationId: this.access.context.organizationId,
      employeeId,
    });
    return this.repository.listOwnHandoffs(this.scope(), employeeId, 25);
  }
  async listAuthorizedIncidents() {
    this.access.requireAny(["VIEW_SITE_OPERATIONS", "VIEW_CLIENT_INCIDENTS"], {
      organizationId: this.access.context.organizationId,
    });
    const visibility = this.access.context.capabilities.has(
      "VIEW_SITE_OPERATIONS",
    )
      ? [...this.access.context.visibility]
      : ["CLIENT_VISIBLE" as const];
    return this.repository.listIncidents(this.scope(), visibility, 25);
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
  async createIncident(raw: CreateIncidentInput) {
    const input = validateIncident(raw);
    if (!input.shiftAssignmentId)
      throw new ResourceNotFoundError("Shift assignment");
    const context = await this.repository.getActivityContext(
      this.scope(),
      input.shiftAssignmentId,
    );
    if (!context) throw new ResourceNotFoundError("Shift assignment");
    this.access.requireHierarchical("CREATE_INCIDENT", {
      ...context,
      visibility: input.visibility,
    });
    if (context.employeeId !== this.access.context.scope.employeeId)
      throw new PermissionDeniedError();
    if (context.assignmentStatus === "cancelled")
      throw new InvariantViolationError(
        "A cancelled assignment cannot receive incident reports.",
      );
    const occurredAt = this.now();
    if (
      occurredAt < new Date(context.scheduledStart) ||
      occurredAt > new Date(context.scheduledEnd)
    )
      throw new InvariantViolationError(
        "Incident reports can only be submitted during the current assignment.",
      );
    if (input.originatingActivityEntryId) {
      const activity = await this.repository.getOriginatingActivity(
        this.scope(),
        context,
        input.originatingActivityEntryId,
      );
      if (!activity) throw new ResourceNotFoundError("Originating activity");
    }
    return this.repository.createIncident(
      this.scope(),
      context,
      { ...input, occurredAt: occurredAt.toISOString() },
      this.access.auditContext(),
    );
  }
  async createHandoff(raw: CreateHandoffInput) {
    const input = validateHandoff(raw);
    if (!input.shiftAssignmentId)
      throw new ResourceNotFoundError("Shift assignment");
    const context = await this.repository.getActivityContext(
      this.scope(),
      input.shiftAssignmentId,
    );
    if (!context) throw new ResourceNotFoundError("Shift assignment");
    this.access.requireHierarchical("SUBMIT_HANDOFF", {
      ...context,
      visibility: input.visibility,
    });
    if (context.employeeId !== this.access.context.scope.employeeId)
      throw new PermissionDeniedError();
    if (context.assignmentStatus === "cancelled")
      throw new InvariantViolationError(
        "A cancelled assignment cannot receive a handoff.",
      );
    const submittedAt = this.now();
    if (
      submittedAt < new Date(context.scheduledStart) ||
      submittedAt > new Date(context.scheduledEnd)
    )
      throw new InvariantViolationError(
        "Handoffs can only be submitted during the current assignment.",
      );
    return this.repository.createHandoff(
      this.scope(),
      context,
      { ...input, submittedAt: submittedAt.toISOString() },
      this.access.auditContext(),
    );
  }
}
