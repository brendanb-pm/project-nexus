import { describe, expect, it } from "vitest";
import { PeopleAdminService } from "@/features/people-admin/service";
import type {
  EmployeeMutation,
  PeopleAdminRepository,
  TrustedEmployeeScope,
} from "@/features/people-admin/repository";
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
import type { EmployeeSummary } from "@/features/people-admin/contracts";

class MemoryPeopleRepository implements PeopleAdminRepository {
  employee: EmployeeSummary = {
    id: "employee-1",
    employeeNumber: "NPS-100",
    displayName: "Alex Guard",
    employmentStatus: "active",
    primaryBranchId: "branch-1",
    primaryBranchName: "Central",
    updatedAt: "2026-08-24T00:00:00.000Z",
  };
  lastScope?: TrustedEmployeeScope;
  lastAudit?: AuditContext;
  users = [
    { id: "user-2", email: "alex@example.test", status: "active" as const },
  ];
  calls: string[] = [];
  listBranches(scope: TrustedEmployeeScope) {
    this.lastScope = scope;
    this.calls.push("listBranches");
    return Promise.resolve([
      { id: "branch-1", name: "Central", timezone: "America/Los_Angeles" },
    ]);
  }
  listEmployees(scope: TrustedEmployeeScope, limit: number) {
    this.lastScope = scope;
    this.calls.push("listEmployees");
    return Promise.resolve({
      items: [this.employee].slice(0, limit),
      hasMore: false,
    });
  }
  listLinkableUsers(scope: TrustedEmployeeScope) {
    this.lastScope = scope;
    this.calls.push("listLinkableUsers");
    return Promise.resolve(this.users);
  }
  getEmployee(scope: TrustedEmployeeScope, id: string) {
    this.lastScope = scope;
    this.calls.push("getEmployee");
    return Promise.resolve(
      id === this.employee.id &&
        (scope.organizationWide || scope.branchIds.includes("branch-1"))
        ? this.employee
        : null,
    );
  }
  createEmployee(
    scope: TrustedEmployeeScope,
    input: EmployeeMutation,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("createEmployee");
    return Promise.resolve({
      ...this.employee,
      id: "employee-2",
      employeeNumber: input.employeeNumber,
      displayName: input.displayName,
      workPhone: input.workPhone,
      employmentStatus: input.employmentStatus,
      user: input.userId ? this.users[0] : undefined,
      updatedAt: "2026-08-24T01:00:00.000Z",
    });
  }
  updateEmployee(
    scope: TrustedEmployeeScope,
    id: string,
    input: EmployeeMutation,
    _expected: string,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("updateEmployee");
    return Promise.resolve(
      id === this.employee.id
        ? { ...this.employee, ...input, updatedAt: "2026-08-24T01:00:00.000Z" }
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
  repository = new MemoryPeopleRepository(),
) {
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal,
        authentication: { sessionId: "session-1" },
      }),
    },
    "people-admin.test",
    "request-1",
  );
  return {
    service: new PeopleAdminService(
      new AuthorizedDataAccess(context),
      repository,
    ),
    repository,
  };
}
const input = {
  employeeNumber: "NPS-101",
  displayName: "Jordan Officer",
  workPhone: "555-0101",
  employmentStatus: "active",
  primaryBranchId: "branch-1",
  userId: "user-2",
};
describe("NX-1.4 employee and user administration", () => {
  it("creates a branch-scoped employee with authoritative audit attribution", async () => {
    const { service, repository } = await subject(
      actor(["ADMIN"], { organizationWide: true }),
    );
    await service.createEmployee(input);
    expect(repository.lastScope?.organizationId).toBe("org-1");
    expect(repository.lastAudit).toMatchObject({
      actorUserId: "user-1",
      requestId: "request-1",
    });
  });
  it("denies profile mutation without MANAGE_EMPLOYEES", async () => {
    const { service } = await subject(
      actor(["SUPERVISOR"], { organizationWide: true }),
    );
    await expect(service.createEmployee(input)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });
  it("does not expose an out-of-branch employee through a forged identifier", async () => {
    const { service } = await subject(
      actor(["OPERATIONS_MANAGER"], { branchIds: ["branch-2"] }),
    );
    await expect(service.getEmployee("employee-1")).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });
  it("uses bounded constant-query list operations", async () => {
    const { service, repository } = await subject(
      actor(["ADMIN"], { organizationWide: true }),
    );
    await service.listEmployees();
    expect(repository.calls).toEqual(["listEmployees"]);
  });
  it("validates user links as lookup hints rather than authority", async () => {
    const { service } = await subject(
      actor(["OPERATIONS_MANAGER"], { branchIds: ["branch-1"] }),
    );
    const result = await service.createEmployee(input);
    expect(result.user?.email).toBe("alex@example.test");
  });
  it("rejects malformed employee input before persistence", async () => {
    const { service } = await subject(
      actor(["ADMIN"], { organizationWide: true }),
    );
    await expect(
      service.createEmployee({ ...input, employeeNumber: "" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
