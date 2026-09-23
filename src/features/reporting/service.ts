import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  InvariantViolationError,
  PermissionDeniedError,
  ResourceNotFoundError,
  StaleUpdateError,
} from "@/server/request/errors";
import {
  validateActivity,
  validateIncident,
  validateAcknowledgement,
  validateAmendment,
} from "./validation";
import type {
  CreateActivityInput,
  CreateIncidentInput,
  AcknowledgeOperationalRecordInput,
  AmendOperationalRecordInput,
} from "./contracts";
import type { ReportingRepository, ReportingScope } from "./repository";
import type { DraftFinalization } from "@/features/reporting-drafts/contracts";

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
  canReview() {
    return (
      this.access.context.capabilities.has("VIEW_SITE_OPERATIONS") &&
      this.access.context.visibility.has("SUPERVISOR")
    );
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
  async getOwnActiveShiftReport(limit = 50) {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Employee relationship");
    this.access.require("VIEW_OWN_ASSIGNMENTS", {
      organizationId: this.access.context.organizationId,
      employeeId,
    });
    const assignment = await this.repository.getActiveAssignment(
      this.scope(),
      employeeId,
      this.now().toISOString(),
    );
    if (!assignment)
      return {
        assignment: null,
        timeline: [],
        incidents: [],
        timelineHasMore: false,
      } as const;
    const boundedLimit = Math.min(Math.max(limit, 1), 50);
    const [activityRows, incidents] = await Promise.all([
      this.repository.listAssignmentActivities(
        this.scope(),
        employeeId,
        assignment.id,
        boundedLimit + 1,
      ),
      this.repository.listAssignmentIncidents(
        this.scope(),
        employeeId,
        assignment.id,
        25,
      ),
    ]);
    const timelineHasMore = activityRows.length > boundedLimit;
    const timeline = activityRows.slice(0, boundedLimit).toReversed();
    return { assignment, timeline, incidents, timelineHasMore } as const;
  }

  /** A Guard may correct a report for their own completed assignment. The
   * canonical mutation methods still enforce assignment ownership and timing. */
  async getOwnShiftReport(assignmentId: string, limit = 50) {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Employee relationship");
    this.access.require("VIEW_OWN_ASSIGNMENTS", {
      organizationId: this.access.context.organizationId,
      employeeId,
    });
    const assignment = await this.repository.getActivityContext(
      this.scope(),
      assignmentId,
    );
    if (
      !assignment ||
      assignment.employeeId !== employeeId ||
      assignment.assignmentStatus === "cancelled"
    )
      throw new ResourceNotFoundError("Shift assignment");
    const boundedLimit = Math.min(Math.max(limit, 1), 50);
    const [activityRows, incidents] = await Promise.all([
      this.repository.listAssignmentActivities(
        this.scope(),
        employeeId,
        assignment.id,
        boundedLimit + 1,
      ),
      this.repository.listAssignmentIncidents(
        this.scope(),
        employeeId,
        assignment.id,
        25,
      ),
    ]);
    return {
      assignment,
      timeline: activityRows.slice(0, boundedLimit).toReversed(),
      incidents,
      timelineHasMore: activityRows.length > boundedLimit,
    } as const;
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
  async listAuthorizedIncidents(limit = 25) {
    this.access.requireAny(["VIEW_SITE_OPERATIONS", "VIEW_CLIENT_INCIDENTS"], {
      organizationId: this.access.context.organizationId,
    });
    const visibility = this.access.context.capabilities.has(
      "VIEW_SITE_OPERATIONS",
    )
      ? [...this.access.context.visibility]
      : ["CLIENT_VISIBLE" as const];
    return this.repository.listIncidents(
      this.scope(),
      visibility,
      Math.min(Math.max(limit, 1), 100),
    );
  }
  async listAuthorizedActivities(limit = 25) {
    this.access.requireOrganization("VIEW_SITE_OPERATIONS");
    return this.repository.listReviewActivities(
      this.scope(),
      [...this.access.context.visibility],
      Math.min(Math.max(limit, 1), 100),
    );
  }
  async listAuthorizedHandoffs(limit = 25) {
    this.access.requireOrganization("VIEW_SITE_OPERATIONS");
    return this.repository.listReviewHandoffs(
      this.scope(),
      [...this.access.context.visibility],
      Math.min(Math.max(limit, 1), 100),
    );
  }
  async getReviewRecord(
    entityType: "ActivityEntry" | "IncidentReport" | "Handoff",
    recordId: string,
  ) {
    const record = await this.repository.getReviewRecord(
      this.scope(),
      entityType,
      recordId,
      25,
    );
    if (!record) throw new ResourceNotFoundError("Operational record");
    this.access.requireHierarchical("VIEW_SITE_OPERATIONS", record);
    return record;
  }
  async acknowledgeOperationalRecord(raw: AcknowledgeOperationalRecordInput) {
    const input = validateAcknowledgement(raw);
    const record = await this.repository.getReviewRecord(
      this.scope(),
      input.entityType,
      input.recordId,
      25,
    );
    if (!record) throw new ResourceNotFoundError("Operational record");
    this.access.requireHierarchical("ACKNOWLEDGE_OPERATIONAL_RECORD", record);
    if (record.acknowledgedByUserId) return record;
    return this.repository.acknowledgeReviewRecord(
      this.scope(),
      record,
      this.access.context.actor.userId,
      this.now().toISOString(),
      this.access.auditContext(),
    );
  }
  async amendOperationalRecord(raw: AmendOperationalRecordInput) {
    const input = validateAmendment(raw);
    const record = await this.repository.getReviewRecord(
      this.scope(),
      input.entityType,
      input.recordId,
      25,
    );
    if (!record) throw new ResourceNotFoundError("Operational record");
    this.access.requireHierarchical("AMEND_OPERATIONAL_RECORD", record);
    if (
      record.revision !== input.expectedRevision &&
      !record.history.some(
        (item) => item.snapshot.idempotencyKey === input.idempotencyKey,
      )
    )
      throw new StaleUpdateError();
    const changed = await this.repository.amendReviewRecord(
      this.scope(),
      record,
      input.expectedRevision,
      input.reason,
      input.amendment,
      input.idempotencyKey,
      this.access.context.actor.userId,
      this.now().toISOString(),
      this.access.auditContext(),
    );
    if (!changed) throw new StaleUpdateError();
    return changed;
  }
  async createActivity(raw: CreateActivityInput, draft?: DraftFinalization) {
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
    if (occurredAt < new Date(context.scheduledStart))
      throw new InvariantViolationError(
        "Activity entries cannot be recorded before the assignment begins.",
      );
    return this.repository.createActivity(
      this.scope(),
      context,
      { ...input, occurredAt: occurredAt.toISOString() },
      this.access.auditContext(),
      draft,
    );
  }
  async createIncident(raw: CreateIncidentInput, draft?: DraftFinalization) {
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
    if (occurredAt < new Date(context.scheduledStart))
      throw new InvariantViolationError(
        "Incident reports cannot be submitted before the assignment begins.",
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
      draft,
    );
  }
}
