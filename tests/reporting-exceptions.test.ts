/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { PermissionDeniedError } from "@/server/request/errors";
import { deriveReportingObligations } from "@/features/reporting-exceptions/policy";
import { ReportingExceptionService } from "@/features/reporting-exceptions/service";
import type { ReportingExceptionRepository } from "@/features/reporting-exceptions/repository";

const now = new Date("2026-09-22T20:30:00.000Z");
const exception = {
  id: "exception-1",
  organizationId: "org-1",
  assignmentId: "assignment-1",
  employeeId: "employee-1",
  branchId: "branch-1",
  clientId: "client-1",
  siteId: "site-1",
  postId: "post-1",
  obligationType: "EOSR" as const,
  classification: "LATE" as const,
  state: "OPEN" as const,
  dueAt: "2026-09-22T20:15:00.000Z",
  effectiveShiftEndAt: "2026-09-22T20:00:00.000Z",
  firstDetectedAt: "2026-09-22T20:16:00.000Z",
  revision: 0,
  sourceHref: "/reporting#shift-closeout",
};

class Repo implements ReportingExceptionRepository {
  transitions: any[] = [];
  reconciliations = 0;
  async reconcile() {
    this.reconciliations += 1;
  }
  async list() {
    return [exception];
  }
  async detail(_scope: any, id: string) {
    return id === exception.id ? { exception, history: [] } : null;
  }
  async dossier(_scope: any, id: string) {
    return id === exception.id
      ? {
          exception,
          history: [],
          context: {
            clientName: "Client",
            siteName: "Site",
            siteTimezone: "America/Los_Angeles",
            postName: "Post",
            employeeNumber: "G-1",
            scheduledStart: "2026-09-22T12:00:00.000Z",
            scheduledEnd: "2026-09-22T20:00:00.000Z",
            assignmentStatus: "confirmed",
          },
          evidence: {
            activities: [],
            incidents: [],
            activityHasMore: false,
            incidentHasMore: false,
          },
          actors: {},
        }
      : null;
  }
  async transition(_scope: any, input: any) {
    this.transitions.push(input);
    return {
      exception: { ...exception, state: input.nextState, revision: 1 },
      history: [],
    } as any;
  }
}

async function subject(
  role:
    | "GUARD"
    | "SUPERVISOR"
    | "OPERATIONS_MANAGER"
    | "ADMIN"
    | "LEADERSHIP"
    | "CLIENT_USER",
  employeeId = "employee-1",
) {
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: {
          userId: "user-1",
          organizationId: "org-1",
          roles: [role],
          employeeId,
          organizationWide: true,
          branchIds: [],
          clientIds: [],
          siteIds: [],
        },
      }),
    },
    "reporting-exceptions.test",
  );
  const repo = new Repo();
  return {
    repo,
    service: new ReportingExceptionService(
      new AuthorizedDataAccess(context),
      repo,
      () => now,
    ),
  };
}

describe("NX-8.5 reporting obligations", () => {
  it("reads an authorized evidence dossier without reconciling or transitioning", async () => {
    const operations = await subject("OPERATIONS_MANAGER");
    await expect(
      operations.service.dossier(exception.id),
    ).resolves.toMatchObject({
      exception: { id: exception.id },
      context: { siteName: "Site" },
    });
    expect(operations.repo.reconciliations).toBe(0);
    expect(operations.repo.transitions).toHaveLength(0);
    await expect(operations.service.dossier("unknown")).rejects.toBeInstanceOf(
      Error,
    );
    const client = await subject("CLIENT_USER");
    await expect(client.service.dossier(exception.id)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    const leadership = await subject("LEADERSHIP");
    await expect(
      leadership.service.dossier(exception.id),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
  it("creates nothing for cancelled/no-work evidence and uses server receipt for delayed correction", () => {
    const base = {
      assignmentId: "assignment-1",
      organizationId: "org-1",
      effectiveShiftEndAt: "2026-09-22T20:00:00.000Z",
      clockedIn: false,
      positiveApprovedTimeRecord: false,
      reportableActivities: [],
    };
    expect(deriveReportingObligations(base, now)).toEqual([]);
    const obligations = deriveReportingObligations(
      { ...base, clockedIn: true, eosrSubmittedAt: "2026-09-22T20:45:00.000Z" },
      now,
    );
    expect(obligations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "EOSR",
          classification: "LATE",
          fulfilledAt: "2026-09-22T20:45:00.000Z",
        }),
      ]),
    );
  });

  it("uses the earliest reportable-incident deadline and does not multiply obligations", () => {
    const obligations = deriveReportingObligations(
      {
        assignmentId: "assignment-1",
        organizationId: "org-1",
        effectiveShiftEndAt: "2026-09-22T21:00:00.000Z",
        clockedIn: true,
        positiveApprovedTimeRecord: false,
        reportableActivities: [
          { id: "activity-1", submittedAt: "2026-09-22T19:50:00.000Z" },
        ],
      },
      new Date("2026-09-22T20:55:00.000Z"),
    );
    expect(
      obligations.filter((entry) => entry.type === "INCIDENT_REPORT"),
    ).toEqual([
      expect.objectContaining({
        dueAt: "2026-09-22T20:50:00.000Z",
        classification: "LATE",
      }),
    ]);
  });

  it("keeps guard access own-only and denies reporting-exception administration", async () => {
    const { service } = await subject("GUARD");
    await expect(service.listOwn()).resolves.toHaveLength(1);
    await expect(
      service.transition({
        exceptionId: exception.id,
        nextState: "ACKNOWLEDGED",
        reason: "forged",
        expectedRevision: 0,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("does not treat an administrative-looking role label as a lifecycle bypass", async () => {
    const leadership = await subject("LEADERSHIP");
    await expect(leadership.service.listOperations()).resolves.toHaveLength(1);
    await expect(
      leadership.service.transition({
        exceptionId: exception.id,
        nextState: "WAIVED",
        reason: "Forged administrative request",
        expectedRevision: 0,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("limits Supervisors to acknowledgement/correction review and gives Operations remediation authority", async () => {
    const supervisor = await subject("SUPERVISOR");
    await expect(
      supervisor.service.transition({
        exceptionId: exception.id,
        nextState: "WAIVED",
        reason: "not allowed",
        expectedRevision: 0,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await supervisor.service.transition({
      exceptionId: exception.id,
      nextState: "ACKNOWLEDGED",
      reason: "Reviewed",
      expectedRevision: 0,
    });
    expect(supervisor.repo.transitions).toHaveLength(1);
    const operations = await subject("OPERATIONS_MANAGER");
    await operations.service.transition({
      exceptionId: exception.id,
      nextState: "WAIVED",
      reason: "Authorized operational waiver",
      expectedRevision: 0,
    });
    expect(operations.repo.transitions).toHaveLength(1);
  });

  it("rejects impossible lifecycle jumps and requires a nonblank transition reason", async () => {
    const { service } = await subject("ADMIN");
    await expect(
      service.transition({
        exceptionId: exception.id,
        nextState: "RESOLVED",
        reason: "Cannot skip review",
        expectedRevision: 0,
      }),
    ).rejects.toThrow(/transition/i);
    await expect(
      service.transition({
        exceptionId: exception.id,
        nextState: "ACKNOWLEDGED",
        reason: " ",
        expectedRevision: 0,
      }),
    ).rejects.toThrow(/reason/i);
  });

  it("treats an authorized replay as a no-op without bypassing authorization", async () => {
    const operations = await subject("OPERATIONS_MANAGER");
    await expect(
      operations.service.transition({
        exceptionId: exception.id,
        nextState: "OPEN",
        reason: "Replay after an uncertain response",
        expectedRevision: 0,
      }),
    ).resolves.toEqual({ exception, history: [] });
    expect(operations.repo.transitions).toHaveLength(0);

    const guard = await subject("GUARD");
    await expect(
      guard.service.transition({
        exceptionId: exception.id,
        nextState: "OPEN",
        reason: "Forged replay",
        expectedRevision: 0,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
