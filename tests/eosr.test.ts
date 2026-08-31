import { describe, expect, it } from "vitest";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { PermissionDeniedError } from "@/server/request/errors";
import { EndOfShiftReportService } from "@/features/eosr/service";
import type { EndOfShiftReportRepository } from "@/features/eosr/repository";
import type { ActivityContext } from "@/features/reporting/repository";

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
  scheduledStart: "2026-09-01T00:00:00.000Z",
  scheduledEnd: "2026-09-02T00:00:00.000Z",
};
class Repo implements EndOfShiftReportRepository {
  reports: any[] = [];
  async getAssignment(_: any, id: string) {
    return id === context.id ? context : null;
  }
  async create(_: any, c: any, input: any) {
    const existing = this.reports.find(
      (item) => item.submissionKey === input.submissionKey,
    );
    if (existing) return existing;
    const report = {
      id: "eosr-1",
      ...input,
      shiftAssignmentId: c.id,
      siteName: c.siteName,
      postName: c.postName,
      submittedAt: "2026-09-01T12:00:00.000Z",
    };
    this.reports.push(report);
    return report;
  }
  async listIncomingPassdowns() {
    return [];
  }
  async setPassdownDismissal(
    _: any,
    passdown: any,
    __: string,
    dismissed: boolean,
  ) {
    return { ...passdown, dismissed };
  }
  async listShiftClose() {
    return [];
  }
}
async function service(employeeId = "employee-1", role = "GUARD") {
  const request = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: {
          userId: "user-1",
          organizationId: "org-1",
          roles: [role as "GUARD"],
          employeeId,
          organizationWide: true,
          branchIds: [],
          clientIds: [],
          siteIds: [],
        },
      }),
    },
    "eosr.test",
  );
  const repo = new Repo();
  return {
    repo,
    service: new EndOfShiftReportService(
      new AuthorizedDataAccess(request),
      repo,
      () => new Date("2026-09-01T12:00:00.000Z"),
    ),
  };
}
describe("NX4.4 EOSR", () => {
  it("binds an idempotent EOSR to the authoritative assignment", async () => {
    const { repo, service: value } = await service();
    const input = {
      shiftAssignmentId: "assignment-1",
      summary: "Shift closed without incident.",
      unresolvedIssues: "Door closer",
      submissionKey: "retry",
    };
    await value.submit(input);
    await value.submit(input);
    expect(repo.reports).toHaveLength(1);
    expect(repo.reports[0]).toMatchObject({
      shiftAssignmentId: "assignment-1",
      submittedByUserId: "user-1",
    });
  });
  it("denies a forged Guard assignment", async () => {
    const { service: value } = await service("employee-2");
    await expect(
      value.submit({
        shiftAssignmentId: "assignment-1",
        summary: "Forged report",
        submissionKey: "forged",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
