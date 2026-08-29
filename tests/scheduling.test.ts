import { describe, expect, it } from "vitest";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import {
  AuthorizedDataAccess,
  type AuditContext,
} from "@/server/request/boundary";
import {
  InvariantViolationError,
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
} from "@/server/request/errors";
import { SchedulingService } from "@/features/scheduling/service";
import type {
  PostSchedulingScope,
  SchedulingRepository,
  SchedulingScope,
  ShiftMutation,
  AssignmentCandidate,
} from "@/features/scheduling/repository";
import type { ShiftSummary } from "@/features/scheduling/contracts";
import type {
  AssignmentSummary,
  AvailabilitySummary,
  ClockEventSummary,
} from "@/features/scheduling/contracts";
import type { ComplianceSummary } from "@/features/compliance-admin/contracts";

class MemorySchedulingRepository implements SchedulingRepository {
  post: PostSchedulingScope = {
    organizationId: "org-1",
    branchId: "branch-1",
    clientId: "client-1",
    siteId: "site-1",
    postId: "post-1",
    timezone: "America/Los_Angeles",
    armedRequirement: "unarmed",
    qualificationRequirements: [],
  };
  shifts: ShiftSummary[] = [];
  availability: AvailabilitySummary[] = [];
  assignments: AssignmentSummary[] = [];
  clockEvents: ClockEventSummary[] = [];
  candidate: Omit<
    AssignmentCandidate,
    "availability" | "credentials" | "certifications"
  > & {
    credentials: ComplianceSummary[];
    certifications: ComplianceSummary[];
  } = {
    organizationId: "org-1",
    employeeId: "employee-1",
    employeeNumber: "NPS-100",
    employeeStatus: "active" as const,
    credentials: [],
    certifications: [],
  };
  activeAssignments = 0;
  audit?: AuditContext;
  calls: string[] = [];
  getPostScope(scope: SchedulingScope, postId: string) {
    this.calls.push("getPostScope");
    return Promise.resolve(
      scope.organizationId === this.post.organizationId &&
        postId === this.post.postId
        ? this.post
        : null,
    );
  }
  listShifts(_scope: SchedulingScope, limit: number) {
    this.calls.push("listShifts");
    return Promise.resolve({
      items: this.shifts.slice(0, limit),
      hasMore: false,
    });
  }
  getShift(_scope: SchedulingScope, shiftId: string) {
    this.calls.push("getShift");
    return Promise.resolve(
      this.shifts.find((shift) => shift.id === shiftId) ?? null,
    );
  }
  countActiveAssignments() {
    this.calls.push("countActiveAssignments");
    return Promise.resolve(this.activeAssignments);
  }
  createShift(
    _scope: SchedulingScope,
    input: ShiftMutation,
    audit: AuditContext,
  ) {
    this.calls.push("createShift");
    this.audit = audit;
    const shift: ShiftSummary = {
      id: `shift-${this.shifts.length + 1}`,
      organizationId: this.post.organizationId,
      siteId: this.post.siteId,
      clientId: this.post.clientId,
      branchId: this.post.branchId,
      postName: "Lobby",
      siteName: "HQ",
      assignedCount: 0,
      updatedAt: "2026-08-29T10:00:00.000Z",
      ...input,
    };
    this.shifts.push(shift);
    return Promise.resolve(shift);
  }
  updateShift(
    _scope: SchedulingScope,
    shiftId: string,
    input: ShiftMutation,
    expectedUpdatedAt: string,
    audit: AuditContext,
  ) {
    this.calls.push("updateShift");
    this.audit = audit;
    const index = this.shifts.findIndex((shift) => shift.id === shiftId);
    if (index < 0 || this.shifts[index].updatedAt !== expectedUpdatedAt)
      return Promise.resolve(null);
    const updated = {
      ...this.shifts[index],
      ...input,
      updatedAt: "2026-08-29T11:00:00.000Z",
    };
    this.shifts[index] = updated;
    return Promise.resolve(updated);
  }
  listAvailability(_scope: SchedulingScope, employeeId: string, limit: number) {
    this.calls.push("listAvailability");
    return Promise.resolve(
      this.availability
        .filter((item) => item.employeeId === employeeId)
        .slice(0, limit),
    );
  }
  createAvailability(
    _scope: SchedulingScope,
    employeeId: string,
    input: {
      startsAt: string;
      endsAt: string;
      status: "AVAILABLE" | "UNAVAILABLE";
    },
    audit: AuditContext,
  ) {
    this.calls.push("createAvailability");
    this.audit = audit;
    const item: AvailabilitySummary = {
      id: `availability-${this.availability.length + 1}`,
      employeeId,
      updatedAt: "2026-08-29T10:00:00.000Z",
      ...input,
    };
    this.availability.push(item);
    return Promise.resolve(item);
  }
  getAssignmentCandidate(scope: SchedulingScope, employeeId: string) {
    this.calls.push("getAssignmentCandidate");
    return Promise.resolve(
      scope.organizationId === this.candidate.organizationId &&
        employeeId === this.candidate.employeeId
        ? { ...this.candidate, availability: this.availability }
        : null,
    );
  }
  hasOverlappingAssignment(
    _scope: SchedulingScope,
    employeeId: string,
    startsAt: string,
    endsAt: string,
  ) {
    this.calls.push("hasOverlappingAssignment");
    return Promise.resolve(
      this.assignments.some(
        (item) =>
          item.employeeId === employeeId &&
          new Date(item.shift.scheduledStart) < new Date(endsAt) &&
          new Date(startsAt) < new Date(item.shift.scheduledEnd),
      ),
    );
  }
  createAssignment(
    _scope: SchedulingScope,
    shiftId: string,
    employeeId: string,
    availability: AssignmentSummary["availability"],
    warnings: readonly string[],
    audit: AuditContext,
  ) {
    this.calls.push("createAssignment");
    this.audit = audit;
    const shift = this.shifts.find((item) => item.id === shiftId)!;
    const item: AssignmentSummary = {
      id: `assignment-${this.assignments.length + 1}`,
      organizationId: shift.organizationId,
      shiftId,
      employeeId,
      employeeNumber: this.candidate.employeeNumber,
      shift,
      status: "assigned",
      availability,
      warnings,
      assignedAt: "2026-08-29T10:00:00.000Z",
      updatedAt: "2026-08-29T10:00:00.000Z",
    };
    this.assignments.push(item);
    return Promise.resolve(item);
  }
  listAssignments(_scope: SchedulingScope, limit: number) {
    this.calls.push("listAssignments");
    return Promise.resolve(this.assignments.slice(0, limit));
  }
  getClockContext(_scope: SchedulingScope, assignmentId: string) {
    this.calls.push("getClockContext");
    const assignment = this.assignments.find(
      (item) => item.id === assignmentId,
    );
    if (!assignment) return Promise.resolve(null);
    return Promise.resolve({
      organizationId: assignment.organizationId,
      branchId: assignment.shift.branchId,
      clientId: assignment.shift.clientId,
      siteId: assignment.shift.siteId,
      employeeId: assignment.employeeId,
      assignmentId,
      assignmentStatus: assignment.status,
      scheduledStart: assignment.shift.scheduledStart,
      scheduledEnd: assignment.shift.scheduledEnd,
      siteLatitude: 45.5231,
      siteLongitude: -122.6765,
      geofenceRadiusMeters: 150,
      events: this.clockEvents.filter(
        (event) => event.shiftAssignmentId === assignmentId,
      ),
    });
  }
  createClockEvent(
    _scope: SchedulingScope,
    _context: NonNullable<
      Awaited<ReturnType<MemorySchedulingRepository["getClockContext"]>>
    >,
    event: Omit<ClockEventSummary, "id">,
    audit: AuditContext,
  ) {
    this.calls.push("createClockEvent");
    this.audit = audit;
    const created = { id: `clock-${this.clockEvents.length + 1}`, ...event };
    this.clockEvents.push(created);
    return Promise.resolve(created);
  }
}

const principal = (
  roles: AuthenticatedPrincipal["roles"],
  values: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal => ({
  userId: "manager-1",
  organizationId: "org-1",
  roles,
  branchIds: [],
  clientIds: [],
  siteIds: [],
  ...values,
});

async function subject(
  actor: AuthenticatedPrincipal,
  repository = new MemorySchedulingRepository(),
  now: () => Date = () => new Date(),
) {
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: actor,
        authentication: { sessionId: "session-1" },
      }),
    },
    "scheduling.test",
    "request-1",
  );
  return {
    service: new SchedulingService(
      new AuthorizedDataAccess(context),
      repository,
      now,
    ),
    repository,
  };
}

const shiftInput = {
  postId: "post-1",
  timezone: "America/Los_Angeles",
  scheduledStart: "2026-11-07T22:00:00-08:00",
  scheduledEnd: "2026-11-08T06:00:00-08:00",
  staffingRequirement: 2,
  status: "DRAFT",
};

describe("NX-2.1 shift scheduling", () => {
  it("creates an overnight shift with authoritative scope and audit attribution", async () => {
    const { service, repository } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    const shift = await service.createShift(shiftInput);
    expect(shift.scheduledEnd).toBe("2026-11-08T14:00:00.000Z");
    expect(repository.audit).toMatchObject({
      actorUserId: "manager-1",
      requestId: "request-1",
    });
  });

  it("rejects nonexistent spring-forward time and ambiguous time without an offset", async () => {
    const { service } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    await expect(
      service.createShift({
        ...shiftInput,
        scheduledStart: "2026-03-08T02:30:00-08:00",
        scheduledEnd: "2026-03-08T04:00:00-07:00",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.createShift({
        ...shiftInput,
        scheduledStart: "2026-11-01T01:30:00",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts an explicitly disambiguated fall-back instant", async () => {
    const { service } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    await expect(
      service.createShift({
        ...shiftInput,
        scheduledStart: "2026-11-01T01:30:00-08:00",
        scheduledEnd: "2026-11-01T02:30:00-08:00",
      }),
    ).resolves.toBeDefined();
  });

  it("denies client users and cross-hierarchy forged posts", async () => {
    const client = await subject(
      principal(["CLIENT_USER"], { siteIds: ["site-1"] }),
    );
    await expect(client.service.createShift(shiftInput)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    const scoped = await subject(
      principal(["OPERATIONS_MANAGER"], { siteIds: ["site-2"] }),
    );
    await expect(scoped.service.createShift(shiftInput)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    await expect(
      scoped.service.createShift({ ...shiftInput, postId: "forged" }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("blocks invalid transitions and staffed material changes", async () => {
    const { service, repository } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    const shift = await service.createShift({
      ...shiftInput,
      status: "PUBLISHED",
    });
    repository.activeAssignments = 1;
    await expect(
      service.updateShift({
        ...shiftInput,
        shiftId: shift.id,
        expectedUpdatedAt: shift.updatedAt,
        status: "CANCELLED",
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError);
    repository.activeAssignments = 0;
    repository.shifts[0] = { ...repository.shifts[0], status: "COMPLETED" };
    await expect(
      service.updateShift({
        ...shiftInput,
        shiftId: shift.id,
        expectedUpdatedAt: shift.updatedAt,
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError);
  });

  it("uses one bounded repository call for lists", async () => {
    const { service, repository } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    await service.listShifts(500);
    expect(repository.calls).toEqual(["listShifts"]);
  });
});

describe("NX-2.2 availability and assignments", () => {
  it("allows adjacent self-owned availability but rejects overlap", async () => {
    const { service } = await subject(
      principal(["GUARD"], { employeeId: "employee-1", siteIds: ["site-1"] }),
    );
    await service.createOwnAvailability({
      timezone: "America/Los_Angeles",
      startsAt: "2026-11-07T14:00:00-08:00",
      endsAt: "2026-11-07T22:00:00-08:00",
      status: "AVAILABLE",
    });
    await expect(
      service.createOwnAvailability({
        timezone: "America/Los_Angeles",
        startsAt: "2026-11-07T22:00:00-08:00",
        endsAt: "2026-11-08T06:00:00-08:00",
        status: "AVAILABLE",
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createOwnAvailability({
        timezone: "America/Los_Angeles",
        startsAt: "2026-11-07T21:00:00-08:00",
        endsAt: "2026-11-07T23:00:00-08:00",
        status: "AVAILABLE",
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError);
  });

  it("assigns an eligible employee and reports unknown availability as a warning", async () => {
    const { service, repository } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    const shift = await service.createShift({
      ...shiftInput,
      status: "PUBLISHED",
    });
    const assignment = await service.assignEmployee({
      shiftId: shift.id,
      employeeId: "employee-1",
    });
    expect(assignment.availability).toBe("UNKNOWN");
    expect(assignment.warnings).toHaveLength(1);
    expect(repository.audit?.actorUserId).toBe("manager-1");
  });

  it("blocks explicit unavailability and overlapping active assignments", async () => {
    const first = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    const shift = await first.service.createShift({
      ...shiftInput,
      status: "PUBLISHED",
    });
    first.repository.availability.push({
      id: "unavailable-1",
      employeeId: "employee-1",
      startsAt: shift.scheduledStart,
      endsAt: shift.scheduledEnd,
      status: "UNAVAILABLE",
      updatedAt: shift.updatedAt,
    });
    await expect(
      first.service.assignEmployee({
        shiftId: shift.id,
        employeeId: "employee-1",
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError);
    first.repository.availability = [];
    await first.service.assignEmployee({
      shiftId: shift.id,
      employeeId: "employee-1",
    });
    const adjacent = await first.service.createShift({
      ...shiftInput,
      scheduledStart: "2026-11-08T06:00:00-08:00",
      scheduledEnd: "2026-11-08T14:00:00-08:00",
      status: "PUBLISHED",
    });
    await expect(
      first.service.assignEmployee({
        shiftId: adjacent.id,
        employeeId: "employee-1",
      }),
    ).resolves.toBeDefined();
  });

  it("enforces qualification and armed authorization requirements", async () => {
    const { service, repository } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    repository.post.armedRequirement = "armed";
    repository.post.qualificationRequirements = ["first_aid"];
    const shift = await service.createShift({
      ...shiftInput,
      status: "PUBLISHED",
    });
    await expect(
      service.assignEmployee({ shiftId: shift.id, employeeId: "employee-1" }),
    ).rejects.toThrow(/first_aid|armed authorization/);
    repository.candidate.credentials.push({
      id: "armed-1",
      employeeId: "employee-1",
      kind: "credential",
      type: "armed_authorization",
      issuingAuthority: "State",
      issuedOn: "2026-01-01",
      status: "active",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    repository.candidate.certifications.push({
      id: "first-aid-1",
      employeeId: "employee-1",
      kind: "certification",
      type: "first_aid",
      issuingAuthority: "Fictional trainer",
      issuedOn: "2026-01-01",
      status: "active",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await expect(
      service.assignEmployee({ shiftId: shift.id, employeeId: "employee-1" }),
    ).resolves.toBeDefined();
  });
});

describe("NX-2.3 geofence clock events", () => {
  async function clockSubject(now: string, actorEmployeeId = "employee-1") {
    const repository = new MemorySchedulingRepository();
    const manager = await subject(
      principal(["ADMIN"], { organizationWide: true }),
      repository,
    );
    const shift = await manager.service.createShift({
      ...shiftInput,
      status: "PUBLISHED",
    });
    const assignment = await manager.service.assignEmployee({
      shiftId: shift.id,
      employeeId: "employee-1",
    });
    return {
      ...(await subject(
        principal(["GUARD"], {
          employeeId: actorEmployeeId,
          siteIds: ["site-1"],
        }),
        repository,
        () => new Date(now),
      )),
      assignment,
    };
  }

  it("records normal self clock-in using server time and Haversine evidence", async () => {
    const { service, assignment } = await clockSubject(
      "2026-11-08T05:55:00.000Z",
    );
    const event = await service.clockOwnShift({
      shiftAssignmentId: assignment.id,
      eventType: "CLOCK_IN",
      latitude: 45.5231,
      longitude: -122.6765,
      accuracyMeters: 15,
    });
    expect(event).toMatchObject({
      occurredAt: "2026-11-08T05:55:00.000Z",
      effectiveAt: "2026-11-08T05:55:00.000Z",
      verificationStatus: "NORMAL",
      recordedByUserId: "manager-1",
    });
  });

  it("preserves timing, accuracy, and geofence failures as exceptions", async () => {
    const { service, assignment } = await clockSubject(
      "2026-11-08T04:00:00.000Z",
    );
    const event = await service.clockOwnShift({
      shiftAssignmentId: assignment.id,
      eventType: "CLOCK_IN",
      latitude: 45.6,
      longitude: -122.7,
      accuracyMeters: 150,
    });
    expect(event.verificationStatus).toBe("EXCEPTION_REQUIRED");
    expect(event.exceptionReasons).toEqual(
      expect.arrayContaining([
        "OUTSIDE_SCHEDULE_WINDOW",
        "LOCATION_INACCURATE",
        "OUTSIDE_GEOFENCE",
      ]),
    );
  });

  it("preserves missing location and never expands radius by accuracy", async () => {
    const missing = await clockSubject("2026-11-08T05:55:00.000Z");
    const event = await missing.service.clockOwnShift({
      shiftAssignmentId: missing.assignment.id,
      eventType: "CLOCK_IN",
    });
    expect(event.exceptionReasons).toContain("LOCATION_MISSING");

    const outsideSubject = await clockSubject("2026-11-08T05:55:00.000Z");
    const outside = await outsideSubject.service.clockOwnShift({
      shiftAssignmentId: outsideSubject.assignment.id,
      eventType: "CLOCK_IN",
      latitude: 45.525,
      longitude: -122.6765,
      accuracyMeters: 99,
    });
    expect(outside.exceptionReasons).toContain("OUTSIDE_GEOFENCE");
  });

  it("denies clocking another employee and rejects invalid event order", async () => {
    const forged = await clockSubject("2026-11-08T05:55:00.000Z", "employee-2");
    await expect(
      forged.service.clockOwnShift({
        shiftAssignmentId: forged.assignment.id,
        eventType: "CLOCK_IN",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    const own = await clockSubject("2026-11-08T05:55:00.000Z");
    await expect(
      own.service.clockOwnShift({
        shiftAssignmentId: own.assignment.id,
        eventType: "CLOCK_OUT",
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError);
  });
});
