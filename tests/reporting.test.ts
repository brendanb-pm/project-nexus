import { describe, expect, it } from "vitest";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { PermissionDeniedError } from "@/server/request/errors";
import { ReportingService } from "@/features/reporting/service";
import type { ActivityEntrySummary } from "@/features/reporting/contracts";
import type {
  ActivityContext,
  NewActivity,
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
  async listOwnAssignments() {
    return [context];
  }
  async getActivityContext(_scope: ReportingScope, id: string) {
    return id === context.id ? context : null;
  }
  async listRecent() {
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
}
async function subject(
  employeeId = "employee-1",
  role: "GUARD" | "CLIENT_USER" = "GUARD",
) {
  const request = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: {
          userId: "user-1",
          organizationId: "org-1",
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
});
