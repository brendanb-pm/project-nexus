import { describe, expect, it, vi } from "vitest";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import {
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
} from "@/server/request/errors";
import { ReportingService } from "@/features/reporting/service";
import type {
  ActivityEntrySummary,
  HandoffSummary,
  IncidentReportSummary,
} from "@/features/reporting/contracts";
import type { ReviewRecord } from "@/features/reporting/contracts";
import type { AuditContext } from "@/server/request/boundary";
import type {
  ActivityContext,
  NewActivity,
  NewIncident,
  ReportingRepository,
  ReportingScope,
} from "@/features/reporting/repository";

const context: ActivityContext = {
  id: "assignment-1",
  organizationId: "org-1",
  branchId: "branch-1",
  clientId: "client-1",
  siteId: "site-1",
  postId: "post-1",
  employeeId: "employee-1",
  assignmentStatus: "assigned",
  siteName: "Cedar",
  postName: "Lobby",
  scheduledStart: "2026-08-29T00:00:00.000Z",
  scheduledEnd: "2026-08-30T00:00:00.000Z",
};
const approvedParticipants = [
  {
    type: "SUBJECT",
    identityState: "UNIDENTIFIED",
    descriptiveIdentifier: "Person in a dark jacket near the east entrance",
    involvementSummary: "Attempted entry through the secured east entrance.",
  },
] as const;
class Repo implements ReportingRepository {
  entries: Array<ActivityEntrySummary & { submissionKey: string }> = [];
  incidents: Array<
    IncidentReportSummary & { submissionKey: string; reportedByUserId: string }
  > = [];
  handoffs: Array<
    HandoffSummary & { submissionKey: string; actorUserId: string }
  > = [];
  revisions = new Map<string, ReviewRecord>();
  private inScope(scope: ReportingScope) {
    return (
      scope.organizationId === context.organizationId &&
      (scope.organizationWide ||
        scope.branchIds.includes(context.branchId) ||
        scope.clientIds.includes(context.clientId) ||
        scope.siteIds.includes(context.siteId))
    );
  }
  async getReviewRecord(
    _scope: ReportingScope,
    entityType: "ActivityEntry" | "IncidentReport" | "Handoff",
    id: string,
  ) {
    return this.revisions.get(`${entityType}:${id}`) ?? null;
  }
  async acknowledgeReviewRecord(
    _scope: ReportingScope,
    record: ReviewRecord,
    actorUserId: string,
    acknowledgedAt: string,
  ) {
    const updated = {
      ...record,
      acknowledgedByUserId: actorUserId,
      acknowledgedAt,
    };
    this.revisions.set(`${record.entityType}:${record.id}`, updated);
    return updated;
  }
  async amendReviewRecord(
    _scope: ReportingScope,
    record: ReviewRecord,
    expectedRevision: number,
    reason: string,
    amendment: Record<string, unknown>,
    idempotencyKey: string,
    actorUserId: string,
    changedAt: string,
  ) {
    const current = this.revisions.get(`${record.entityType}:${record.id}`);
    if (!current) return null;
    const duplicate = current.history.find(
      (item) => item.snapshot.idempotencyKey === idempotencyKey,
    );
    if (duplicate) return current;
    if (current.revision !== expectedRevision) return null;
    const updated: ReviewRecord = {
      ...current,
      revision: current.revision + 1,
      snapshot: { ...current.snapshot, ...amendment },
      history: [
        ...current.history,
        {
          revision: current.revision + 1,
          changedByUserId: actorUserId,
          changedAt,
          reason,
          snapshot: { ...current.snapshot, ...amendment, idempotencyKey },
        },
      ],
    };
    this.revisions.set(`${record.entityType}:${record.id}`, updated);
    return updated;
  }
  async listOwnAssignments() {
    return [context];
  }
  async getActiveAssignment(
    scope: ReportingScope,
    employeeId: string,
    at: string,
  ) {
    const instant = new Date(at);
    return this.inScope(scope) &&
      employeeId === context.employeeId &&
      instant >= new Date(context.scheduledStart) &&
      instant <= new Date(context.scheduledEnd)
      ? context
      : null;
  }
  async getActivityContext(_scope: ReportingScope, id: string) {
    return id === context.id ? context : null;
  }
  async listRecent() {
    return this.entries;
  }
  async listAssignmentActivities(
    scope: ReportingScope,
    employeeId: string,
    assignmentId: string,
    limit: number,
  ) {
    return this.entries
      .filter(
        (entry) =>
          this.inScope(scope) &&
          employeeId === context.employeeId &&
          entry.shiftAssignmentId === assignmentId,
      )
      .toReversed()
      .slice(0, limit);
  }
  async listReviewActivities() {
    return this.entries;
  }
  async createActivity(
    _scope: ReportingScope,
    value: ActivityContext,
    input: NewActivity,
  ) {
    const existing = this.entries.find(
      (entry) => entry.submissionKey === input.submissionKey,
    );
    if (existing) return existing;
    const entry = {
      id: `activity-${this.entries.length + 1}`,
      shiftAssignmentId: value.id,
      siteName: value.siteName,
      postName: value.postName,
      occurredAt: input.occurredAt,
      category: input.category,
      narrative: input.narrative,
      followUpRequired: input.followUpRequired,
      visibility: input.visibility,
      status: "SUBMITTED" as const,
      createdAt: input.occurredAt,
      submissionKey: input.submissionKey,
      incidentGate:
        input.category === "REPORTABLE_INCIDENT"
          ? ("REQUIRED" as const)
          : input.category === "SAFETY_CONCERN"
            ? ("SUGGESTED" as const)
            : ("ROUTINE" as const),
    };
    this.entries.push(entry);
    return entry;
  }
  async listOwnIncidents() {
    return this.incidents;
  }
  async listAssignmentIncidents(
    scope: ReportingScope,
    employeeId: string,
    assignmentId: string,
    limit: number,
  ) {
    return this.incidents
      .filter(
        (incident) =>
          this.inScope(scope) &&
          employeeId === context.employeeId &&
          incident.shiftAssignmentId === assignmentId,
      )
      .slice(0, limit);
  }
  async listIncidents() {
    return this.incidents;
  }
  async getOriginatingActivity(
    _scope: ReportingScope,
    value: ActivityContext,
    id: string,
  ) {
    const entry = this.entries.find(
      (candidate) =>
        candidate.id === id && candidate.shiftAssignmentId === value.id,
    );
    return entry ?? null;
  }
  async createIncident(
    _scope: ReportingScope,
    value: ActivityContext,
    input: NewIncident,
    audit: AuditContext,
  ) {
    const existing = this.incidents.find(
      (incident) => incident.submissionKey === input.submissionKey,
    );
    if (existing) return existing;
    const incident = {
      id: `incident-${this.incidents.length + 1}`,
      shiftAssignmentId: value.id,
      incidentNumber: `INC-${this.incidents.length + 1}`,
      classification: input.classification,
      severity: input.severity,
      occurredAt: input.occurredAt,
      narrative: input.narrative,
      actionsTaken: input.actionsTaken,
      emergencyServiceInvolvement: input.emergencyServiceInvolvement,
      status: "SUBMITTED" as const,
      visibility: input.visibility,
      participants: input.participants,
      createdAt: input.occurredAt,
      submissionKey: input.submissionKey,
      reportedByUserId: audit.actorUserId,
      ...(input.originatingActivityEntryId
        ? { originatingActivityEntryId: input.originatingActivityEntryId }
        : {}),
    };
    this.incidents.push(incident);
    return incident;
  }
  async listOwnHandoffs() {
    return this.handoffs;
  }
  async listReviewHandoffs() {
    return this.handoffs;
  }
}
async function subject(
  employeeId = "employee-1",
  role: "GUARD" | "CLIENT_USER" = "GUARD",
  organizationId = "org-1",
  siteIds: readonly string[] = ["site-1"],
) {
  const request = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: {
          userId: "user-1",
          organizationId,
          roles: [role],
          branchIds: [],
          clientIds: [],
          siteIds,
          employeeId,
        },
      }),
    },
    "reporting.test",
  );
  return { repo: new Repo(), request };
}
describe("NX-3.1 activity reporting", () => {
  it("loads one bounded active Shift Report timeline in chronological order", async () => {
    const { repo, request } = await subject();
    const activeAssignment = vi.spyOn(repo, "getActiveAssignment");
    const activities = vi.spyOn(repo, "listAssignmentActivities");
    const incidents = vi.spyOn(repo, "listAssignmentIncidents");
    repo.entries.push(
      {
        id: "activity-1",
        shiftAssignmentId: "assignment-1",
        siteName: "Cedar",
        postName: "Lobby",
        occurredAt: "2026-08-29T09:00:00.000Z",
        category: "OBSERVATION",
        narrative: "First",
        followUpRequired: false,
        visibility: "INTERNAL",
        status: "SUBMITTED",
        createdAt: "2026-08-29T09:00:00.000Z",
        submissionKey: "first",
        incidentGate: "ROUTINE",
      },
      {
        id: "activity-2",
        shiftAssignmentId: "assignment-1",
        siteName: "Cedar",
        postName: "Lobby",
        occurredAt: "2026-08-29T10:00:00.000Z",
        category: "SAFETY_CHECK",
        narrative: "Second",
        followUpRequired: false,
        visibility: "INTERNAL",
        status: "SUBMITTED",
        createdAt: "2026-08-29T10:00:00.000Z",
        submissionKey: "second",
        incidentGate: "ROUTINE",
      },
    );
    const result = await new ReportingService(
      new AuthorizedDataAccess(request),
      repo,
      () => new Date("2026-08-29T12:00:00.000Z"),
    ).getOwnActiveShiftReport(1);
    expect(result.assignment?.id).toBe("assignment-1");
    expect(result.timeline.map((entry) => entry.id)).toEqual(["activity-2"]);
    expect(result.timelineHasMore).toBe(true);
    expect(activeAssignment).toHaveBeenCalledTimes(1);
    expect(activities).toHaveBeenCalledWith(
      expect.any(Object),
      "employee-1",
      "assignment-1",
      2,
    );
    expect(incidents).toHaveBeenCalledWith(
      expect.any(Object),
      "employee-1",
      "assignment-1",
      25,
    );
  });

  it("does not expose an active assignment or timeline across employee, tenant, or site scope", async () => {
    for (const { employeeId, organizationId, siteIds } of [
      {
        employeeId: "employee-2",
        organizationId: "org-1",
        siteIds: ["site-1"],
      },
      {
        employeeId: "employee-1",
        organizationId: "org-2",
        siteIds: ["site-1"],
      },
      {
        employeeId: "employee-1",
        organizationId: "org-1",
        siteIds: ["site-2"],
      },
    ]) {
      const { repo, request } = await subject(
        employeeId,
        "GUARD",
        organizationId,
        siteIds,
      );
      repo.entries.push({
        id: "protected-activity",
        shiftAssignmentId: context.id,
        siteName: context.siteName,
        postName: context.postName,
        occurredAt: "2026-08-29T10:00:00.000Z",
        category: "OBSERVATION",
        narrative: "Must remain scoped",
        followUpRequired: false,
        visibility: "INTERNAL",
        status: "SUBMITTED",
        createdAt: "2026-08-29T10:00:00.000Z",
        submissionKey: "protected",
        incidentGate: "ROUTINE",
      });
      const result = await new ReportingService(
        new AuthorizedDataAccess(request),
        repo,
        () => new Date("2026-08-29T12:00:00.000Z"),
      ).getOwnActiveShiftReport();
      expect(result).toMatchObject({
        assignment: null,
        timeline: [],
        incidents: [],
      });
    }
  });
  it("derives authoritative assignment context and deduplicates safe retry", async () => {
    const { repo, request } = await subject();
    const service = new ReportingService(
      new AuthorizedDataAccess(request),
      repo,
      () => new Date("2026-08-29T12:00:00.000Z"),
    );
    const input = {
      shiftAssignmentId: "assignment-1",
      category: "OBSERVATION",
      narrative: "Door secured",
      submissionKey: "retry-key",
    };
    await service.createActivity(input);
    await service.createActivity(input);
    expect(repo.entries).toHaveLength(1);
    expect(repo.entries[0]).toMatchObject({
      shiftAssignmentId: "assignment-1",
      status: "SUBMITTED",
    });
  });
  it("denies a forged employee relationship and client-user mutation", async () => {
    const forged = await subject("employee-2");
    await expect(
      new ReportingService(
        new AuthorizedDataAccess(forged.request),
        forged.repo,
      ).createActivity({
        shiftAssignmentId: "assignment-1",
        category: "OBSERVATION",
        narrative: "Forged",
        submissionKey: "forged",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    const client = await subject("employee-1", "CLIENT_USER");
    await expect(
      new ReportingService(
        new AuthorizedDataAccess(client.request),
        client.repo,
      ).createActivity({
        shiftAssignmentId: "assignment-1",
        category: "OBSERVATION",
        narrative: "Forbidden",
        submissionKey: "client",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("uses the server time and permits an owned completed assignment to be corrected", async () => {
    const { repo, request } = await subject();
    const service = new ReportingService(
      new AuthorizedDataAccess(request),
      repo,
      () => new Date("2026-08-31T12:00:00.000Z"),
    );
    await expect(
      service.createActivity({
        shiftAssignmentId: "assignment-1",
        category: "OBSERVATION",
        narrative: "Too late",
        occurredAt: "2020-01-01T00:00:00.000Z",
        submissionKey: "late",
      }),
    ).resolves.toMatchObject({ occurredAt: "2026-08-31T12:00:00.000Z" });
    expect(repo.entries).toHaveLength(1);
  });

  it("persists an explainable reportable-incident gate without creating an incident", async () => {
    const { repo, request } = await subject();
    const entry = await new ReportingService(
      new AuthorizedDataAccess(request),
      repo,
      () => new Date("2026-08-29T12:00:00.000Z"),
    ).createActivity({
      shiftAssignmentId: "assignment-1",
      category: "REPORTABLE_INCIDENT",
      narrative: "Unauthorized entry reported.",
      submissionKey: "incident-gate",
    });
    expect(entry.incidentGate).toBe("REQUIRED");
    expect(repo.entries).toHaveLength(1);
  });

  it("creates a durable incident from trusted assignment context and deduplicates retry", async () => {
    const { repo, request } = await subject();
    const service = new ReportingService(
      new AuthorizedDataAccess(request),
      repo,
      () => new Date("2026-08-29T12:00:00.000Z"),
    );
    const input = {
      shiftAssignmentId: "assignment-1",
      classification: "SECURITY",
      severity: "HIGH",
      narrative: "Unauthorized entry attempted.",
      actionsTaken: "Denied entry and notified supervision.",
      visibility: "INTERNAL",
      participants: approvedParticipants,
      submissionKey: "incident-retry-key",
    };
    const first = await service.createIncident(input);
    const second = await service.createIncident(input);
    expect(repo.incidents).toHaveLength(1);
    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({
      shiftAssignmentId: "assignment-1",
      reportedByUserId: "user-1",
      status: "SUBMITTED",
    });
  });

  it("requires participants and rejects participant types outside the Product Owner allowlist", async () => {
    const { repo, request } = await subject();
    const service = new ReportingService(
      new AuthorizedDataAccess(request),
      repo,
      () => new Date("2026-08-29T12:00:00.000Z"),
    );
    const base = {
      shiftAssignmentId: "assignment-1",
      classification: "SECURITY",
      severity: "LOW",
      narrative: "Incident detail",
      actionsTaken: "Secured the area",
      submissionKey: "participant-validation",
    };
    await expect(
      service.createIncident({ ...base, participants: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.createIncident({
        ...base,
        participants: [
          {
            type: "VICTIM",
            identityState: "IDENTIFIED",
            displayName: "A Person",
            involvementSummary: "Reported the event.",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.incidents).toHaveLength(0);
  });

  it("accepts an unidentified subject without a fabricated name and enforces OTHER and AGENCY fields", async () => {
    const { repo, request } = await subject();
    const service = new ReportingService(
      new AuthorizedDataAccess(request),
      repo,
      () => new Date("2026-08-29T12:00:00.000Z"),
    );
    await service.createIncident({
      shiftAssignmentId: "assignment-1",
      classification: "SECURITY",
      severity: "LOW",
      narrative: "Unidentified person attempted entry.",
      actionsTaken: "Entry denied.",
      participants: approvedParticipants,
      submissionKey: "unidentified-subject",
    });
    expect(repo.incidents[0]?.participants?.[0]).toMatchObject({
      type: "SUBJECT",
      identityState: "UNIDENTIFIED",
    });
    for (const participants of [
      [
        {
          type: "OTHER",
          identityState: "IDENTIFIED",
          displayName: "Resident",
          involvementSummary: "Provided access context.",
        },
      ],
      [
        {
          type: "AGENCY",
          involvementSummary: "Responded to the scene.",
        },
      ],
    ])
      await expect(
        service.createIncident({
          shiftAssignmentId: "assignment-1",
          classification: "SECURITY",
          severity: "LOW",
          narrative: "Validation case.",
          actionsTaken: "Documented response.",
          participants,
          submissionKey: `invalid-${participants[0]!.type}`,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
  });

  it("denies client mutation and an originating activity from another assignment", async () => {
    const client = await subject("employee-1", "CLIENT_USER");
    await expect(
      new ReportingService(
        new AuthorizedDataAccess(client.request),
        client.repo,
      ).createIncident({
        shiftAssignmentId: "assignment-1",
        classification: "SECURITY",
        severity: "LOW",
        narrative: "Forbidden",
        actionsTaken: "None",
        participants: approvedParticipants,
        submissionKey: "client-incident",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    const { repo, request } = await subject();
    await expect(
      new ReportingService(
        new AuthorizedDataAccess(request),
        repo,
        () => new Date("2026-08-29T12:00:00.000Z"),
      ).createIncident({
        shiftAssignmentId: "assignment-1",
        originatingActivityEntryId: "other-assignment-activity",
        classification: "SECURITY",
        severity: "LOW",
        narrative: "Wrong activity",
        actionsTaken: "None",
        participants: approvedParticipants,
        submissionKey: "wrong-activity",
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("denies cross-organization and restricted-visibility incident submission", async () => {
    const crossOrganization = await subject("employee-1", "GUARD", "org-2");
    await expect(
      new ReportingService(
        new AuthorizedDataAccess(crossOrganization.request),
        crossOrganization.repo,
        () => new Date("2026-08-29T12:00:00.000Z"),
      ).createIncident({
        shiftAssignmentId: "assignment-1",
        classification: "SECURITY",
        severity: "LOW",
        narrative: "Cross organization",
        actionsTaken: "None",
        participants: approvedParticipants,
        submissionKey: "cross-organization",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    const guard = await subject();
    await expect(
      new ReportingService(
        new AuthorizedDataAccess(guard.request),
        guard.repo,
        () => new Date("2026-08-29T12:00:00.000Z"),
      ).createIncident({
        shiftAssignmentId: "assignment-1",
        classification: "SECURITY",
        severity: "LOW",
        narrative: "Restricted visibility",
        actionsTaken: "None",
        visibility: "RESTRICTED",
        participants: approvedParticipants,
        submissionKey: "restricted-visibility",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("NX-3.5 supervisor acknowledgement and amendments", () => {
  async function reviewer(
    role:
      | "SUPERVISOR"
      | "OPERATIONS_MANAGER"
      | "GUARD"
      | "CLIENT_USER" = "SUPERVISOR",
    organizationId = "org-1",
  ) {
    const request = await createAuthenticatedRequestContext(
      {
        resolve: async () => ({
          principal: {
            userId: "supervisor-1",
            organizationId,
            roles: [role],
            branchIds: [],
            clientIds: [],
            siteIds: ["site-1"],
          },
        }),
      },
      "review.test",
    );
    const repo = new Repo();
    repo.revisions.set("ActivityEntry:activity-1", {
      entityType: "ActivityEntry",
      id: "activity-1",
      organizationId: "org-1",
      branchId: "branch-1",
      clientId: "client-1",
      siteId: "site-1",
      visibility: "INTERNAL",
      revision: 0,
      snapshot: {
        narrative: "Original guard entry",
        authoredByUserId: "guard-1",
      },
      history: [],
    });
    return {
      repo,
      service: new ReportingService(
        new AuthorizedDataAccess(request),
        repo,
        () => new Date("2026-08-30T12:00:00.000Z"),
      ),
    };
  }
  it("acknowledges idempotently with the authoritative actor", async () => {
    const { service } = await reviewer();
    const first = await service.acknowledgeOperationalRecord({
      entityType: "ActivityEntry",
      recordId: "activity-1",
    });
    const second = await service.acknowledgeOperationalRecord({
      entityType: "ActivityEntry",
      recordId: "activity-1",
    });
    expect(first.acknowledgedByUserId).toBe("supervisor-1");
    expect(second.acknowledgedAt).toBe(first.acknowledgedAt);
  });
  it("requires reason, preserves authorship, is retry safe, and rejects stale amendments", async () => {
    const { service } = await reviewer();
    await expect(
      service.amendOperationalRecord({
        entityType: "ActivityEntry",
        recordId: "activity-1",
        expectedRevision: 0,
        reason: "",
        amendment: { narrative: "Corrected" },
        idempotencyKey: "a",
      }),
    ).rejects.toThrow(/highlighted/i);
    const first = await service.amendOperationalRecord({
      entityType: "ActivityEntry",
      recordId: "activity-1",
      expectedRevision: 0,
      reason: "Clarifies sequence",
      amendment: { narrative: "Corrected" },
      idempotencyKey: "retry-1",
    });
    const retried = await service.amendOperationalRecord({
      entityType: "ActivityEntry",
      recordId: "activity-1",
      expectedRevision: 0,
      reason: "Clarifies sequence",
      amendment: { narrative: "Corrected" },
      idempotencyKey: "retry-1",
    });
    expect(first.revision).toBe(1);
    expect(retried.revision).toBe(1);
    expect(first.snapshot.authoredByUserId).toBe("guard-1");
    await expect(
      service.amendOperationalRecord({
        entityType: "ActivityEntry",
        recordId: "activity-1",
        expectedRevision: 0,
        reason: "Another correction",
        amendment: { narrative: "Other" },
        idempotencyKey: "other",
      }),
    ).rejects.toBeInstanceOf(
      (await import("@/server/request/errors")).StaleUpdateError,
    );
  });
  it("denies guard, client-user, and cross-tenant review mutations", async () => {
    for (const role of ["GUARD", "CLIENT_USER"] as const)
      await expect(
        (await reviewer(role)).service.acknowledgeOperationalRecord({
          entityType: "ActivityEntry",
          recordId: "activity-1",
        }),
      ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      (
        await reviewer("SUPERVISOR", "org-2")
      ).service.acknowledgeOperationalRecord({
        entityType: "ActivityEntry",
        recordId: "activity-1",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
  it("denies unauthorized and cross-tenant canonical record reads", async () => {
    await expect(
      (await reviewer("GUARD")).service.getReviewRecord(
        "ActivityEntry",
        "activity-1",
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      (await reviewer("SUPERVISOR", "org-2")).service.getReviewRecord(
        "ActivityEntry",
        "activity-1",
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
