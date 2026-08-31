import { describe, expect, it } from "vitest";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import {
  PermissionDeniedError,
  ResourceNotFoundError,
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
  NewHandoff,
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
class Repo implements ReportingRepository {
  entries: Array<ActivityEntrySummary & { submissionKey: string }> = [];
  incidents: Array<
    IncidentReportSummary & { submissionKey: string; reportedByUserId: string }
  > = [];
  handoffs: Array<
    HandoffSummary & { submissionKey: string; actorUserId: string }
  > = [];
  revisions = new Map<string, ReviewRecord>();
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
  async getActivityContext(_scope: ReportingScope, id: string) {
    return id === context.id ? context : null;
  }
  async listRecent() {
    return this.entries;
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
  async createHandoff(
    _scope: ReportingScope,
    value: ActivityContext,
    input: NewHandoff,
    audit: AuditContext,
  ) {
    const existing = this.handoffs.find(
      (handoff) => handoff.submissionKey === input.submissionKey,
    );
    if (existing) return existing;
    const handoff = {
      id: `handoff-${this.handoffs.length + 1}`,
      shiftAssignmentId: value.id,
      siteName: value.siteName,
      postName: value.postName,
      unresolvedIssues: input.unresolvedIssues,
      equipmentKeyStatus: input.equipmentKeyStatus,
      followUpItems: input.followUpItems,
      submittedAt: input.submittedAt,
      status: "SUBMITTED" as const,
      visibility: input.visibility,
      createdAt: input.submittedAt,
      submissionKey: input.submissionKey,
      actorUserId: audit.actorUserId,
    };
    this.handoffs.push(handoff);
    return handoff;
  }
}
async function subject(
  employeeId = "employee-1",
  role: "GUARD" | "CLIENT_USER" = "GUARD",
  organizationId = "org-1",
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
          siteIds: ["site-1"],
          employeeId,
        },
      }),
    },
    "reporting.test",
  );
  return { repo: new Repo(), request };
}
describe("NX-3.1 activity reporting", () => {
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

  it("uses the server time and rejects an assignment outside its active window", async () => {
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
    ).rejects.toThrow(/current assignment/i);
    expect(repo.entries).toHaveLength(0);
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
        submissionKey: "restricted-visibility",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("NX-3.4 end-of-shift handoffs", () => {
  it("submits an idempotent handoff from trusted assignment context", async () => {
    const { repo, request } = await subject();
    const service = new ReportingService(
      new AuthorizedDataAccess(request),
      repo,
      () => new Date("2026-08-29T12:00:00.000Z"),
    );
    const input = {
      shiftAssignmentId: "assignment-1",
      unresolvedIssues: "Door closer needs service\nVisitor log is low",
      equipmentKeyStatus: "Two radios charging; lobby key secured.",
      followUpItems: "Notify facilities",
      submissionKey: "handoff-retry",
    };
    const first = await service.createHandoff(input);
    const second = await service.createHandoff(input);
    expect(repo.handoffs).toHaveLength(1);
    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({
      shiftAssignmentId: "assignment-1",
      status: "SUBMITTED",
      unresolvedIssues: ["Door closer needs service", "Visitor log is low"],
      actorUserId: "user-1",
    });
  });

  it("denies a client user, forged employee, cross-organization, and restricted handoff", async () => {
    const client = await subject("employee-1", "CLIENT_USER");
    await expect(
      new ReportingService(
        new AuthorizedDataAccess(client.request),
        client.repo,
      ).createHandoff({
        shiftAssignmentId: "assignment-1",
        submissionKey: "client-handoff",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    const forged = await subject("employee-2");
    await expect(
      new ReportingService(
        new AuthorizedDataAccess(forged.request),
        forged.repo,
      ).createHandoff({
        shiftAssignmentId: "assignment-1",
        submissionKey: "forged-handoff",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    const crossOrg = await subject("employee-1", "GUARD", "org-2");
    await expect(
      new ReportingService(
        new AuthorizedDataAccess(crossOrg.request),
        crossOrg.repo,
      ).createHandoff({
        shiftAssignmentId: "assignment-1",
        submissionKey: "cross-org-handoff",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    const guard = await subject();
    await expect(
      new ReportingService(
        new AuthorizedDataAccess(guard.request),
        guard.repo,
      ).createHandoff({
        shiftAssignmentId: "assignment-1",
        visibility: "RESTRICTED",
        submissionKey: "restricted-handoff",
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
});
