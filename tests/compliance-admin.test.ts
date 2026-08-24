import { describe, expect, it } from "vitest";
import { ComplianceAdminService } from "@/features/compliance-admin/service";
import {
  evaluateEmployeeEligibility,
  ARMED_AUTHORIZATION_TYPE,
} from "@/features/compliance-admin/eligibility";
import type {
  ComplianceMutation,
  ComplianceAdminRepository,
  TrustedComplianceScope,
} from "@/features/compliance-admin/repository";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import {
  AuthorizedDataAccess,
  type AuditContext,
} from "@/server/request/boundary";
import {
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";
import type { ComplianceSummary } from "@/features/compliance-admin/contracts";
class MemoryComplianceRepository implements ComplianceAdminRepository {
  record: ComplianceSummary = {
    id: "credential-1",
    employeeId: "employee-1",
    kind: "credential",
    type: "armed_authorization",
    identifier: "A-1",
    issuingAuthority: "State",
    issuedOn: "2026-01-01",
    expiresOn: "2027-01-01",
    status: "pending_verification",
    updatedAt: "2026-08-24T00:00:00.000Z",
  };
  lastScope?: TrustedComplianceScope;
  lastAudit?: AuditContext;
  calls: string[] = [];
  employee = {
    id: "employee-1",
    employeeNumber: "NPS-100",
    displayName: "Alex Guard",
    branchId: "branch-1",
    branchName: "Central",
    employmentStatus: "active" as const,
  };
  listEmployees(scope: TrustedComplianceScope) {
    this.lastScope = scope;
    this.calls.push("listEmployees");
    return Promise.resolve(
      scope.organizationWide || scope.branchIds.includes("branch-1")
        ? [this.employee]
        : [],
    );
  }
  getEmployeeDetail(scope: TrustedComplianceScope, id: string) {
    this.lastScope = scope;
    this.calls.push("getEmployeeDetail");
    return Promise.resolve(
      id === "employee-1" &&
        (scope.organizationWide || scope.branchIds.includes("branch-1"))
        ? {
            employee: this.employee,
            credentials: [this.record],
            certifications: [],
          }
        : null,
    );
  }
  getRecord(
    scope: TrustedComplianceScope,
    kind: "credential" | "certification",
    id: string,
  ) {
    this.lastScope = scope;
    this.calls.push("getRecord");
    return Promise.resolve(
      kind === "credential" &&
        id === this.record.id &&
        (scope.organizationWide || scope.branchIds.includes("branch-1"))
        ? this.record
        : null,
    );
  }
  create(
    scope: TrustedComplianceScope,
    kind: "credential" | "certification",
    input: ComplianceMutation,
    audit: AuditContext,
    predecessorId?: string,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("create");
    return Promise.resolve({
      ...this.record,
      id: predecessorId ? "credential-2" : "credential-3",
      kind,
      ...input,
      predecessorId,
      updatedAt: "2026-08-24T01:00:00.000Z",
    });
  }
  update(
    scope: TrustedComplianceScope,
    kind: "credential" | "certification",
    id: string,
    input: ComplianceMutation,
    _expected: string,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("update");
    return Promise.resolve(
      id === this.record.id
        ? {
            ...this.record,
            kind,
            ...input,
            updatedAt: "2026-08-24T01:00:00.000Z",
          }
        : null,
    );
  }
  verify(
    scope: TrustedComplianceScope,
    kind: "credential" | "certification",
    id: string,
    _expected: string,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("verify");
    return Promise.resolve(
      id === this.record.id
        ? {
            ...this.record,
            kind,
            status: "active" as const,
            verifiedAt: "2026-08-24T01:00:00.000Z",
            updatedAt: "2026-08-24T01:00:00.000Z",
          }
        : null,
    );
  }
}
function actor(
  roles: AuthenticatedPrincipal["roles"],
  options: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal {
  return {
    userId: "user-1",
    organizationId: "org-1",
    roles,
    branchIds: [],
    clientIds: [],
    siteIds: [],
    ...options,
  };
}
async function subject(
  principal: AuthenticatedPrincipal,
  repository = new MemoryComplianceRepository(),
) {
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal,
        authentication: { sessionId: "session-1" },
      }),
    },
    "compliance.test",
    "request-1",
  );
  return {
    service: new ComplianceAdminService(
      new AuthorizedDataAccess(context),
      repository,
    ),
    repository,
  };
}
const input = {
  employeeId: "employee-1",
  type: ARMED_AUTHORIZATION_TYPE,
  identifier: "A-2",
  issuingAuthority: "State",
  issuedOn: "2026-08-24",
  expiresOn: "2027-08-24",
  status: "pending_verification",
  documentReference: "vault://license/A-2",
};
describe("NX-1.5 compliance administration", () => {
  it("creates scoped compliance with authoritative audit attribution", async () => {
    const { service, repository } = await subject(
      actor(["ADMIN"], { organizationWide: true }),
    );
    await service.create("credential", input);
    expect(repository.lastAudit).toMatchObject({
      actorUserId: "user-1",
      requestId: "request-1",
    });
  });
  it("denies qualification mutation to supervisor and client roles", async () => {
    for (const role of ["SUPERVISOR", "CLIENT_USER"] as const) {
      const { service } = await subject(
        actor([role], { organizationWide: true, clientIds: ["client-1"] }),
      );
      await expect(service.create("credential", input)).rejects.toBeInstanceOf(
        PermissionDeniedError,
      );
    }
  });
  it("denies a forged cross-branch employee identifier", async () => {
    const { service } = await subject(
      actor(["OPERATIONS_MANAGER"], { branchIds: ["branch-2"] }),
    );
    await expect(service.create("credential", input)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });
  it("requires an authoritative verification action before activation", async () => {
    const { service } = await subject(
      actor(["ADMIN"], { organizationWide: true }),
    );
    await expect(
      service.create("credential", { ...input, status: "active" }),
    ).rejects.toMatchObject({ code: "INVARIANT_VIOLATION" });
  });
  it("creates a successor renewal instead of replacing history", async () => {
    const { service, repository } = await subject(
      actor(["ADMIN"], { organizationWide: true }),
    );
    const result = await service.renew("credential", {
      ...input,
      predecessorId: "credential-1",
    });
    expect(result.predecessorId).toBe("credential-1");
    expect(repository.calls).toContain("create");
  });
  it("records verification through the authoritative internal actor", async () => {
    const { service, repository } = await subject(
      actor(["ADMIN"], { organizationWide: true }),
    );
    const verified = await service.verify(
      "credential",
      "credential-1",
      "2026-08-24T00:00:00.000Z",
    );
    expect(verified.verifiedAt).toBeDefined();
    expect(repository.lastAudit?.actorUserId).toBe("user-1");
  });
  it("keeps list/detail hydration bounded and set-oriented", async () => {
    const { service, repository } = await subject(
      actor(["ADMIN"], { organizationWide: true }),
    );
    await service.listEmployees();
    expect(repository.calls).toEqual(["listEmployees"]);
  });
  it("evaluates future eligibility without rewriting historical records", () => {
    const result = evaluateEmployeeEligibility({
      employeeStatus: "active",
      armedRequirement: "armed",
      qualificationRequirements: ["first_aid"],
      credentials: [
        { ...new MemoryComplianceRepository().record, status: "active" },
      ],
      certifications: [
        {
          id: "cert-1",
          employeeId: "employee-1",
          kind: "certification",
          type: "first_aid",
          issuingAuthority: "Red Cross",
          issuedOn: "2026-01-01",
          status: "active",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(result).toMatchObject({ eligible: true, missing: [] });
    const inactive = evaluateEmployeeEligibility({
      employeeStatus: "inactive",
      armedRequirement: "unarmed",
      qualificationRequirements: [],
      credentials: [],
      certifications: [],
    });
    expect(inactive.missing).toContain("active employment");
  });
});
