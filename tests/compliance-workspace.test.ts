import { describe, expect, it } from "vitest";
import { buildComplianceWorkspace } from "@/features/compliance-workspace/workspace";
import { ComplianceWorkspaceService } from "@/features/compliance-workspace/service";
import type { ComplianceWorkspaceRepository } from "@/features/compliance-workspace/repository";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { PermissionDeniedError } from "@/server/request/errors";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";

const credential = {
  id: "credential-1",
  employeeId: "employee-1",
  employeeName: "Guard A",
  employeeNumber: "NPS-100",
  branchId: "branch-1",
  branchName: "Central",
  definitionId: "definition-1",
  key: "guard-card",
  displayName: "Guard card",
  state: "verified" as const,
  expiresOn: "2026-10-01",
  jurisdiction: {
    kind: "state_province" as const,
    code: "CA",
    timezone: "America/Los_Angeles",
  },
  warningDays: [60, 30, 14, 7],
};
const requirement = {
  id: "requirement-1",
  postId: "post-1",
  definitionId: "definition-1",
  key: "guard-card",
  displayName: "Guard card",
  severity: "required" as const,
  jurisdiction: {
    kind: "state_province" as const,
    code: "CA",
    timezone: "America/Los_Angeles",
  },
  effectiveStart: "2026-01-01",
};
const assignment = {
  id: "assignment-1",
  employeeId: "employee-1",
  employeeName: "Guard A",
  employeeNumber: "NPS-100",
  branchId: "branch-1",
  branchName: "Central",
  postId: "post-1",
  siteId: "site-1",
  siteName: "Cedar Plaza",
  postName: "North Lobby",
  startsAt: "2026-10-02T05:00:00.000Z",
  endsAt: "2026-10-02T13:00:00.000Z",
  timezone: "America/Los_Angeles",
};

describe("NX5.3 compliance workspace", () => {
  it("ranks a canonical qualification conflict ahead of credential-only risk", () => {
    const result = buildComplianceWorkspace(
      {
        credentials: [credential],
        requirements: [requirement],
        assignments: [assignment],
      },
      new Date("2026-09-25T12:00:00.000Z"),
    );
    expect(result.items[0]).toMatchObject({
      priority: "BLOCKING_ASSIGNMENT",
      reason: "EXPIRES_DURING_SHIFT",
      assignment: { id: "assignment-1", postName: "North Lobby" },
    });
    expect(result.summary.BLOCKING_ASSIGNMENT).toBe(1);
  });

  it("surfaces pending, revoked, and expiry-window state without an assignment", () => {
    const result = buildComplianceWorkspace(
      {
        credentials: [
          {
            ...credential,
            definitionId: "pending",
            key: "pending",
            displayName: "CPR",
            state: "pending_verification",
            expiresOn: undefined,
          },
          {
            ...credential,
            definitionId: "revoked",
            key: "revoked",
            displayName: "Fire watch",
            state: "revoked",
            expiresOn: undefined,
          },
          credential,
        ],
        requirements: [],
        assignments: [],
      },
      new Date("2026-09-25T12:00:00.000Z"),
    );
    expect(result.items.map((item) => item.priority)).toEqual([
      "EXPIRED_OR_RESTRICTED",
      "PENDING_VERIFICATION",
      "EXPIRING_SOON",
    ]);
  });

  it("keeps informational requirements visible without promoting them to hard blocks", () => {
    const result = buildComplianceWorkspace(
      {
        credentials: [],
        requirements: [{ ...requirement, severity: "informational" }],
        assignments: [assignment],
      },
      new Date("2026-09-25T12:00:00.000Z"),
    );
    expect(result.items[0]).toMatchObject({
      priority: "INFORMATIONAL",
      reason: "MISSING",
    });
  });

  it("uses the earliest impacted assignment when one credential affects multiple future shifts", () => {
    const result = buildComplianceWorkspace(
      {
        credentials: [
          {
            ...credential,
            state: "pending_verification",
            expiresOn: undefined,
          },
        ],
        requirements: [requirement],
        assignments: [
          {
            ...assignment,
            id: "later",
            startsAt: "2026-10-03T05:00:00.000Z",
            endsAt: "2026-10-03T13:00:00.000Z",
          },
          assignment,
        ],
      },
      new Date("2026-09-25T12:00:00.000Z"),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.assignment?.id).toBe("assignment-1");
  });
});

class MemoryRepository implements ComplianceWorkspaceRepository {
  scope?: Parameters<ComplianceWorkspaceRepository["load"]>[0];
  async load(scope: Parameters<ComplianceWorkspaceRepository["load"]>[0]) {
    this.scope = scope;
    return { credentials: [], requirements: [], assignments: [] };
  }
}
async function service(roles: AuthenticatedPrincipal["roles"]) {
  const repository = new MemoryRepository();
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: {
          userId: "user-1",
          organizationId: "org-1",
          roles,
          branchIds: ["branch-1"],
          clientIds: [],
          siteIds: [],
        },
        authentication: { sessionId: "session-1" },
      }),
    },
    "compliance-workspace.test",
    "request-1",
  );
  return {
    service: new ComplianceWorkspaceService(
      new AuthorizedDataAccess(context),
      repository,
    ),
    repository,
  };
}
describe("NX5.3 workspace authorization", () => {
  it("allows Operations Managers and carries authoritative scope to the repository", async () => {
    const subject = await service(["OPERATIONS_MANAGER"]);
    await subject.service.list(new Date("2026-09-25T12:00:00.000Z"));
    expect(subject.repository.scope).toMatchObject({
      organizationId: "org-1",
      branchIds: ["branch-1"],
    });
  });
  it("denies Guards before any compliance records are queried", async () => {
    const subject = await service(["GUARD"]);
    await expect(subject.service.list()).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    expect(subject.repository.scope).toBeUndefined();
  });
});
