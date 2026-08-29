import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  InvariantViolationError,
  ResourceNotFoundError,
  StaleUpdateError,
} from "@/server/request/errors";
import type {
  AssignmentMutationInput,
  AvailabilityMutationInput,
  ClockEventInput,
  ShiftMutationInput,
  UpdateShiftInput,
} from "./contracts";
import type { SchedulingRepository, SchedulingScope } from "./repository";
import { validateAvailability, validateShift } from "./validation";
import { intervalsOverlap } from "./time";
import { evaluateEmployeeEligibility } from "@/features/compliance-admin/eligibility";
import { finiteCoordinate, haversineDistanceMeters } from "./geofence";
import { ValidationError } from "@/server/request/errors";

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
    private readonly now: () => Date = () => new Date(),
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

  async listOwnAvailability(limit = 25) {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Employee relationship");
    this.access.require("VIEW_OWN_ASSIGNMENTS", {
      organizationId: this.access.context.organizationId,
      employeeId,
    });
    return this.repository.listAvailability(
      this.scope(),
      employeeId,
      Math.min(Math.max(limit, 1), 100),
    );
  }

  async createOwnAvailability(raw: AvailabilityMutationInput) {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Employee relationship");
    this.access.require("VIEW_OWN_ASSIGNMENTS", {
      organizationId: this.access.context.organizationId,
      employeeId,
    });
    const input = validateAvailability(raw);
    const existing = await this.repository.listAvailability(
      this.scope(),
      employeeId,
      100,
    );
    if (
      existing.some((item) =>
        intervalsOverlap(
          item.startsAt,
          item.endsAt,
          input.startsAt,
          input.endsAt,
        ),
      )
    ) {
      throw new InvariantViolationError(
        "Availability intervals may not overlap; adjacent intervals are allowed.",
      );
    }
    return this.repository.createAvailability(
      this.scope(),
      employeeId,
      input,
      this.access.auditContext(),
    );
  }

  async assignEmployee(raw: AssignmentMutationInput) {
    const shiftId = typeof raw.shiftId === "string" ? raw.shiftId : "";
    const employeeId = typeof raw.employeeId === "string" ? raw.employeeId : "";
    const scope = this.scope();
    const shift = await this.repository.getShift(scope, shiftId);
    if (!shift) throw new ResourceNotFoundError("Shift");
    this.access.requireHierarchical("MANAGE_SHIFT_ASSIGNMENTS", shift);
    if (!["DRAFT", "PUBLISHED"].includes(shift.status)) {
      throw new InvariantViolationError(
        "Only draft or published shifts may be staffed.",
      );
    }
    if (shift.assignedCount >= shift.staffingRequirement) {
      throw new InvariantViolationError(
        "This shift already meets its staffing requirement.",
      );
    }
    const candidate = await this.repository.getAssignmentCandidate(
      scope,
      employeeId,
    );
    if (!candidate || candidate.organizationId !== scope.organizationId) {
      throw new ResourceNotFoundError("Employee");
    }
    if (
      await this.repository.hasOverlappingAssignment(
        scope,
        employeeId,
        shift.scheduledStart,
        shift.scheduledEnd,
      )
    ) {
      throw new InvariantViolationError(
        "Employee already has an overlapping active assignment.",
      );
    }
    const overlappingAvailability = candidate.availability.filter((item) =>
      intervalsOverlap(
        item.startsAt,
        item.endsAt,
        shift.scheduledStart,
        shift.scheduledEnd,
      ),
    );
    if (overlappingAvailability.some((item) => item.status === "UNAVAILABLE")) {
      throw new InvariantViolationError(
        "Employee is explicitly unavailable for this shift.",
      );
    }
    const availability = overlappingAvailability.some(
      (item) => item.status === "AVAILABLE",
    )
      ? "AVAILABLE"
      : "UNKNOWN";
    const post = await this.repository.getPostScope(scope, shift.postId);
    if (!post) throw new ResourceNotFoundError("Post");
    const eligibility = evaluateEmployeeEligibility({
      employeeStatus: candidate.employeeStatus,
      armedRequirement: post.armedRequirement,
      qualificationRequirements: post.qualificationRequirements,
      credentials: candidate.credentials,
      certifications: candidate.certifications,
      asOf: shift.scheduledStart.slice(0, 10),
    });
    if (!eligibility.eligible) {
      throw new InvariantViolationError(
        `Employee is not eligible: ${eligibility.missing.join(", ")}.`,
      );
    }
    const warnings =
      availability === "UNKNOWN"
        ? ["No availability was declared for this interval."]
        : [];
    return this.repository.createAssignment(
      scope,
      shiftId,
      employeeId,
      availability,
      warnings,
      this.access.auditContext(),
    );
  }

  async listAssignments(limit = 25) {
    this.access.requireOrganization("VIEW_SITE_OPERATIONS");
    return this.repository.listAssignments(
      this.scope(),
      Math.min(Math.max(limit, 1), 100),
    );
  }

  async clockOwnShift(raw: ClockEventInput) {
    const assignmentId =
      typeof raw.shiftAssignmentId === "string" ? raw.shiftAssignmentId : "";
    if (
      !assignmentId ||
      !["CLOCK_IN", "CLOCK_OUT"].includes(String(raw.eventType))
    ) {
      throw new ValidationError({
        event: ["Select a valid assignment and clock action."],
      });
    }
    const context = await this.repository.getClockContext(
      this.scope(),
      assignmentId,
    );
    if (!context) throw new ResourceNotFoundError("Shift assignment");
    this.access.requireHierarchical("CLOCK_OWN_SHIFT", {
      organizationId: context.organizationId,
      branchId: context.branchId,
      clientId: context.clientId,
      siteId: context.siteId,
      employeeId: context.employeeId,
    });
    if (context.assignmentStatus === "cancelled") {
      throw new InvariantViolationError(
        "A cancelled assignment cannot be clocked.",
      );
    }
    const eventType = raw.eventType as "CLOCK_IN" | "CLOCK_OUT";
    const previous = context.events.at(-1);
    if (
      (eventType === "CLOCK_IN" && previous?.eventType === "CLOCK_IN") ||
      (eventType === "CLOCK_OUT" && previous?.eventType !== "CLOCK_IN")
    ) {
      throw new InvariantViolationError(
        "Clock events must alternate clock in and clock out.",
      );
    }
    const occurredAt = this.now();
    const scheduled = new Date(
      eventType === "CLOCK_IN" ? context.scheduledStart : context.scheduledEnd,
    );
    const lateMinutes = eventType === "CLOCK_IN" ? 15 : 30;
    const exceptionReasons: string[] = [];
    if (
      occurredAt.valueOf() < scheduled.valueOf() - 15 * 60_000 ||
      occurredAt.valueOf() > scheduled.valueOf() + lateMinutes * 60_000
    ) {
      exceptionReasons.push("OUTSIDE_SCHEDULE_WINDOW");
    }
    const latitude = finiteCoordinate(raw.latitude, -90, 90);
    const longitude = finiteCoordinate(raw.longitude, -180, 180);
    const accuracyMeters = finiteCoordinate(raw.accuracyMeters, 0, 100_000);
    let locationEvidence;
    if (
      latitude === undefined ||
      longitude === undefined ||
      accuracyMeters === undefined
    ) {
      exceptionReasons.push("LOCATION_MISSING");
    } else {
      if (accuracyMeters > 100) exceptionReasons.push("LOCATION_INACCURATE");
      let distanceMeters: number | undefined;
      if (
        context.siteLatitude === undefined ||
        context.siteLongitude === undefined
      ) {
        exceptionReasons.push("SITE_GEOFENCE_UNCONFIGURED");
      } else {
        distanceMeters = haversineDistanceMeters(
          { latitude, longitude },
          {
            latitude: context.siteLatitude,
            longitude: context.siteLongitude,
          },
        );
        if (distanceMeters > context.geofenceRadiusMeters) {
          exceptionReasons.push("OUTSIDE_GEOFENCE");
        }
      }
      locationEvidence = {
        latitude,
        longitude,
        accuracyMeters,
        ...(distanceMeters === undefined ? {} : { distanceMeters }),
      };
    }
    return this.repository.createClockEvent(
      this.scope(),
      context,
      {
        shiftAssignmentId: assignmentId,
        eventType,
        occurredAt: occurredAt.toISOString(),
        effectiveAt: occurredAt.toISOString(),
        verificationStatus: exceptionReasons.length
          ? "EXCEPTION_REQUIRED"
          : "NORMAL",
        exceptionReasons,
        ...(locationEvidence ? { locationEvidence } : {}),
        recordedByUserId: this.access.context.actor.userId,
      },
      this.access.auditContext(),
    );
  }
}
