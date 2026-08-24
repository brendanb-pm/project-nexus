import { describe, expect, it } from "vitest";
import {
  AuthorizedDataAccess,
  type AuditContext,
} from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import {
  DuplicateResourceError,
  InvariantViolationError,
  PermissionDeniedError,
  ResourceNotFoundError,
  StaleUpdateError,
  ValidationError,
} from "@/server/request/errors";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";
import type {
  BranchCursor,
  BranchPage,
  BranchSummary,
  OrganizationSummary,
} from "@/features/organization-admin/contracts";
import {
  MAX_BRANCH_PAGE_SIZE,
  type BranchMutation,
  type OrganizationAdminRepository,
  type OrganizationMutation,
} from "@/features/organization-admin/repository";
import { OrganizationAdminService } from "@/features/organization-admin/service";
import { loadOrganizationAdminPage } from "@/features/organization-admin/application";

const admin: AuthenticatedPrincipal = {
  userId: "admin-1",
  organizationId: "org-1",
  roles: ["ADMIN"],
  branchIds: [],
  clientIds: [],
  siteIds: [],
};
const guard: AuthenticatedPrincipal = {
  userId: "guard-1",
  employeeId: "employee-1",
  organizationId: "org-1",
  roles: ["GUARD"],
  branchIds: ["branch-1"],
  clientIds: [],
  siteIds: [],
};

class MemoryRepository implements OrganizationAdminRepository {
  organization: OrganizationSummary | null = {
    name: "Northstar Protective Services",
    status: "active",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };
  branches: BranchSummary[] = [
    {
      id: "branch-1",
      name: "Central",
      timezone: "America/Los_Angeles",
      status: "active",
      updatedAt: "2026-08-23T00:00:00.000Z",
    },
  ];
  calls: string[] = [];
  lastOrganizationId?: string;
  lastLimit?: number;
  lastAudit?: AuditContext;
  activeDependencies = false;

  async getOrganization(organizationId: string) {
    this.calls.push("getOrganization");
    this.lastOrganizationId = organizationId;
    return this.organization;
  }
  async updateOrganization(
    organizationId: string,
    input: OrganizationMutation,
    expectedUpdatedAt: string,
    audit: AuditContext,
  ) {
    this.calls.push("updateOrganization");
    this.lastOrganizationId = organizationId;
    this.lastAudit = audit;
    if (!this.organization) return null;
    if (this.organization.updatedAt !== expectedUpdatedAt) {
      throw new StaleUpdateError();
    }
    this.organization = {
      ...input,
      updatedAt: "2026-08-23T01:00:00.000Z",
    };
    return this.organization;
  }
  async listBranches(
    organizationId: string,
    options: { limit: number; cursor?: BranchCursor },
  ): Promise<BranchPage> {
    this.calls.push("listBranches");
    this.lastOrganizationId = organizationId;
    this.lastLimit = options.limit;
    return { items: this.branches.slice(0, options.limit) };
  }
  async getBranch(organizationId: string, branchId: string) {
    this.calls.push("getBranch");
    this.lastOrganizationId = organizationId;
    return this.branches.find((branch) => branch.id === branchId) ?? null;
  }
  async createBranch(
    organizationId: string,
    input: BranchMutation,
    audit: AuditContext,
  ) {
    this.calls.push("createBranch");
    this.lastOrganizationId = organizationId;
    this.lastAudit = audit;
    if (
      input.status === "active" &&
      this.branches.some(
        (branch) =>
          branch.status === "active" &&
          branch.name.toLowerCase() === input.name.toLowerCase(),
      )
    ) {
      throw new DuplicateResourceError(
        "An active branch with this name already exists.",
      );
    }
    const branch = {
      id: `branch-${this.branches.length + 1}`,
      ...input,
      updatedAt: "2026-08-23T01:00:00.000Z",
    };
    this.branches.push(branch);
    return branch;
  }
  async updateBranch(
    organizationId: string,
    branchId: string,
    input: BranchMutation,
    expectedUpdatedAt: string,
    audit: AuditContext,
  ) {
    this.calls.push("updateBranch");
    this.lastOrganizationId = organizationId;
    this.lastAudit = audit;
    const index = this.branches.findIndex((branch) => branch.id === branchId);
    if (index < 0) return null;
    if (this.branches[index]?.updatedAt !== expectedUpdatedAt) {
      throw new StaleUpdateError();
    }
    if (input.status === "inactive" && this.activeDependencies) {
      throw new InvariantViolationError(
        "Reassign active clients and employees before deactivating this branch.",
      );
    }
    if (
      input.status === "active" &&
      this.branches.some(
        (branch) =>
          branch.id !== branchId &&
          branch.status === "active" &&
          branch.name.toLowerCase() === input.name.toLowerCase(),
      )
    ) {
      throw new DuplicateResourceError(
        "An active branch with this name already exists.",
      );
    }
    const branch = {
      id: branchId,
      ...input,
      updatedAt: "2026-08-23T01:00:00.000Z",
    };
    this.branches[index] = branch;
    return branch;
  }
}

async function serviceFor(
  actor: AuthenticatedPrincipal,
  repository = new MemoryRepository(),
) {
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: actor,
        authentication: { sessionId: "s-1" },
      }),
    },
    "organization-admin.test",
    "request-1",
  );
  return {
    service: new OrganizationAdminService(
      new AuthorizedDataAccess(context),
      repository,
    ),
    repository,
  };
}

describe("organization and branch administration", () => {
  it("allows an admin to read the authoritative organization and a bounded branch page", async () => {
    const { service, repository } = await serviceFor(admin);
    const state = await loadOrganizationAdminPage(service);
    expect(state).toMatchObject({
      kind: "ready",
      organization: { name: "Northstar Protective Services" },
      branches: { items: [{ name: "Central" }] },
    });
    expect(repository.calls).toEqual(["getOrganization", "listBranches"]);
    expect(repository.lastOrganizationId).toBe("org-1");
    expect(repository.lastLimit).toBe(25);
  });

  it("caps caller-requested branch pages and never performs per-row reads", async () => {
    const { service, repository } = await serviceFor(admin);
    await service.listBranches({ limit: 10_000 });
    expect(repository.lastLimit).toBe(MAX_BRANCH_PAGE_SIZE);
    expect(repository.calls).toEqual(["listBranches"]);
  });

  it("denies organization administration without the centralized capabilities", async () => {
    const { service, repository } = await serviceFor(guard);
    await expect(service.getOrganization()).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    expect(repository.calls).toEqual([]);
  });

  it("uses actor organization scope rather than accepting a tenant in input", async () => {
    const { service, repository } = await serviceFor(admin);
    await service.createBranch({
      name: "North Branch",
      timezone: "America/Los_Angeles",
      status: "active",
    });
    expect(repository.lastOrganizationId).toBe("org-1");
    expect(repository.lastAudit).toMatchObject({
      actorUserId: "admin-1",
      organizationId: "org-1",
      requestId: "request-1",
    });
  });

  it("validates fields before mutation", async () => {
    const { service, repository } = await serviceFor(admin);
    await expect(
      service.createBranch({
        name: " ",
        timezone: "not-a-timezone",
        status: "active",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repository.calls).toEqual([]);
  });

  it("returns a safe not-found result for an out-of-tenant branch hint", async () => {
    const { service } = await serviceFor(admin);
    await expect(service.getBranch("other-org-branch")).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });

  it("updates only the approved organization fields with audit attribution", async () => {
    const { service, repository } = await serviceFor(admin);
    const result = await service.updateOrganization({
      name: "Northstar Security",
      status: "inactive",
      expectedUpdatedAt: "2026-08-23T00:00:00.000Z",
    });
    expect(result).toMatchObject({
      name: "Northstar Security",
      status: "inactive",
    });
    expect(repository.lastAudit?.actorUserId).toBe("admin-1");
  });

  it("rejects a duplicate active branch name", async () => {
    const { service } = await serviceFor(admin);
    await expect(
      service.createBranch({
        name: "central",
        timezone: "America/New_York",
        status: "active",
      }),
    ).rejects.toBeInstanceOf(DuplicateResourceError);
  });

  it("rejects stale branch updates", async () => {
    const { service } = await serviceFor(admin);
    await expect(
      service.updateBranch({
        branchId: "branch-1",
        name: "Central",
        timezone: "America/Los_Angeles",
        status: "active",
        expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StaleUpdateError);
  });

  it("prevents unsafe branch deactivation", async () => {
    const repository = new MemoryRepository();
    repository.activeDependencies = true;
    const { service } = await serviceFor(admin, repository);
    await expect(
      service.updateBranch({
        branchId: "branch-1",
        name: "Central",
        timezone: "America/Los_Angeles",
        status: "inactive",
        expectedUpdatedAt: "2026-08-23T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError);
  });
});
