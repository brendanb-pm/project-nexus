import { describe, expect, it } from "vitest";
import {
  AuthorizedDataAccess,
  type AuditContext,
} from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import {
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
} from "@/server/request/errors";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";
import { ClientAdminService } from "@/features/client-admin/service";
import type {
  ClientAdminRepository,
  ClientMutation,
  ContactMutation,
  ContractMutation,
  TrustedScope,
} from "@/features/client-admin/repository";

class MemoryClientRepository implements ClientAdminRepository {
  clients = [
    {
      id: "client-1",
      branchId: "branch-1",
      branchName: "Central",
      name: "Fictional Museum",
      status: "active" as const,
      updatedAt: "2026-08-23T00:00:00.000Z",
    },
  ];
  lastScope?: TrustedScope;
  lastAudit?: AuditContext;
  calls: string[] = [];
  listBranches(scope: TrustedScope) {
    this.lastScope = scope;
    this.calls.push("listBranches");
    return Promise.resolve([
      { id: "branch-1", name: "Central", timezone: "America/Los_Angeles" },
    ]);
  }
  listClients(scope: TrustedScope, limit: number) {
    this.lastScope = scope;
    this.calls.push("listClients");
    return Promise.resolve({
      items: this.clients.slice(0, limit),
      hasMore: false,
    });
  }
  getClient(scope: TrustedScope, id: string) {
    this.lastScope = scope;
    this.calls.push("getClient");
    return Promise.resolve(
      this.clients.find(
        (c) =>
          c.id === id &&
          (scope.organizationWide ||
            scope.clientIds.includes(id) ||
            scope.branchIds.includes(c.branchId)),
      ) ?? null,
    );
  }
  async getClientDetail(scope: TrustedScope, id: string) {
    const client = await this.getClient(scope, id);
    return client ? { client, contacts: [], contracts: [] } : null;
  }
  createClient(
    scope: TrustedScope,
    input: ClientMutation,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("createClient");
    return Promise.resolve({
      id: "client-2",
      branchName: "Central",
      updatedAt: "2026-08-23T01:00:00.000Z",
      ...input,
    });
  }
  updateClient(
    scope: TrustedScope,
    id: string,
    input: ClientMutation,
    _expected: string,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("updateClient");
    return Promise.resolve({
      id,
      branchName: "Central",
      updatedAt: "2026-08-23T01:00:00.000Z",
      ...input,
    });
  }
  createContact(
    scope: TrustedScope,
    input: ContactMutation,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("createContact");
    return Promise.resolve({
      id: "contact-1",
      updatedAt: "2026-08-23T01:00:00.000Z",
      ...input,
    });
  }
  updateContact(
    scope: TrustedScope,
    id: string,
    input: ContactMutation,
    _expected: string,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("updateContact");
    return Promise.resolve({
      id,
      updatedAt: "2026-08-23T01:00:00.000Z",
      ...input,
    });
  }
  createContract(
    scope: TrustedScope,
    input: ContractMutation,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("createContract");
    return Promise.resolve({
      id: "contract-1",
      updatedAt: "2026-08-23T01:00:00.000Z",
      ...input,
    });
  }
  updateContract(
    scope: TrustedScope,
    id: string,
    input: ContractMutation,
    _expected: string,
    audit: AuditContext,
  ) {
    this.lastScope = scope;
    this.lastAudit = audit;
    this.calls.push("updateContract");
    return Promise.resolve({
      id,
      updatedAt: "2026-08-23T01:00:00.000Z",
      ...input,
    });
  }
}
const actor = (
  roles: AuthenticatedPrincipal["roles"],
  organizationId = "org-1",
  scopes: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal => ({
  userId: "user-1",
  organizationId,
  roles,
  branchIds: [],
  clientIds: [],
  siteIds: [],
  ...scopes,
});
async function subject(
  principal: AuthenticatedPrincipal,
  repository = new MemoryClientRepository(),
) {
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal,
        authentication: { sessionId: "session-1" },
      }),
    },
    "client-admin.test",
    "request-1",
  );
  return {
    service: new ClientAdminService(
      new AuthorizedDataAccess(context),
      repository,
    ),
    repository,
  };
}

describe("NX-1.2 client administration", () => {
  it("uses authoritative organization and audit actor for an admin mutation", async () => {
    const { service, repository } = await subject(
      actor(["ADMIN"], "org-1", { organizationWide: true }),
    );
    await service.createClient({
      branchId: "branch-1",
      name: "New Client",
      status: "active",
    });
    expect(repository.lastScope?.organizationId).toBe("org-1");
    expect(repository.lastAudit).toMatchObject({
      actorUserId: "user-1",
      organizationId: "org-1",
      requestId: "request-1",
    });
  });
  it("denies CLIENT_USER mutation even when the client is in scope", async () => {
    const { service, repository } = await subject(
      actor(["CLIENT_USER"], "org-1", {
        branchIds: ["branch-1"],
        clientIds: ["client-1"],
      }),
    );
    await expect(
      service.createContact({
        clientId: "client-1",
        name: "Pat",
        email: "",
        phone: "",
        status: "active",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(repository.calls).toEqual(["getClient"]);
  });
  it("allows a CLIENT_USER to read only an authorized client", async () => {
    const { service } = await subject(
      actor(["CLIENT_USER"], "org-1", {
        branchIds: ["branch-1"],
        clientIds: ["client-1"],
      }),
    );
    await expect(service.getClientDetail("client-1")).resolves.toMatchObject({
      client: { name: "Fictional Museum" },
    });
    await expect(service.getClientDetail("client-2")).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });
  it("fails cross-organization and forged client hints safely", async () => {
    const { service } = await subject(
      actor(["OPERATIONS_MANAGER"], "org-2", {
        branchIds: ["other-branch"],
        clientIds: ["other-client"],
      }),
    );
    await expect(service.getClientDetail("client-1")).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });
  it("validates optional contact fields and contract date ordering", async () => {
    const { service } = await subject(
      actor(["ADMIN"], "org-1", { organizationWide: true }),
    );
    await expect(
      service.createContact({
        clientId: "client-1",
        name: "Pat",
        email: "bad",
        phone: "",
        status: "active",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.createContract({
        clientId: "client-1",
        name: "Agreement",
        startsOn: "2026-12-01",
        endsOn: "2026-01-01",
        status: "active",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
  it("keeps list work bounded and constant rather than reading each row", async () => {
    const { service, repository } = await subject(
      actor(["ADMIN"], "org-1", { organizationWide: true }),
    );
    const result = await service.listClients();
    expect(result.items).toHaveLength(1);
    expect(repository.calls).toEqual(["listClients"]);
  });
});
