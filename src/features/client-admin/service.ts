import { AuthorizedDataAccess } from "@/server/request/boundary";
import { ResourceNotFoundError } from "@/server/request/errors";
import type {
  CreateClientInput,
  CreateContactInput,
  CreateContractInput,
  UpdateClientInput,
  UpdateContactInput,
  UpdateContractInput,
} from "./contracts";
import {
  CLIENT_PAGE_SIZE,
  type ClientAdminRepository,
  type TrustedScope,
} from "./repository";
import {
  validateClient,
  validateContact,
  validateContract,
  validateVersion,
} from "./validation";

export class ClientAdminService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: ClientAdminRepository,
  ) {}
  private scope(): TrustedScope {
    const c = this.access.context;
    return {
      organizationId: c.organizationId,
      organizationWide: c.scope.organizationWide,
      branchIds: c.scope.branchIds,
      clientIds: c.scope.clientIds,
    };
  }
  private readScope(branchId?: string, clientId?: string) {
    this.access.requireAnyHierarchical(
      ["MANAGE_CLIENTS", "VIEW_CLIENT_REPORTS", "VIEW_SITE_OPERATIONS"],
      {
        organizationId: this.access.context.organizationId,
        branchId,
        clientId,
      },
    );
  }
  private mutateScope(branchId?: string, clientId?: string) {
    this.access.requireHierarchical("MANAGE_CLIENTS", {
      organizationId: this.access.context.organizationId,
      branchId,
      clientId,
    });
  }
  canMutate() {
    return this.access.context.capabilities.has("MANAGE_CLIENTS");
  }
  async listBranches() {
    this.readScope();
    return this.repository.listBranches(this.scope());
  }
  async listClients() {
    this.readScope();
    return this.repository.listClients(this.scope(), CLIENT_PAGE_SIZE);
  }
  async getClientDetail(clientId: string) {
    this.readScope();
    const detail = await this.repository.getClientDetail(
      this.scope(),
      clientId,
    );
    if (!detail) throw new ResourceNotFoundError("Client");
    this.readScope(detail.client.branchId, detail.client.id);
    return detail;
  }
  async createClient(input: CreateClientInput) {
    const value = validateClient(input);
    this.mutateScope(value.branchId);
    return this.repository.createClient(
      this.scope(),
      value,
      this.access.auditContext(),
    );
  }
  async updateClient(input: UpdateClientInput) {
    const value = validateClient(input);
    const clientId = typeof input.clientId === "string" ? input.clientId : "";
    const existing = await this.repository.getClient(this.scope(), clientId);
    if (!existing) throw new ResourceNotFoundError("Client");
    this.mutateScope(existing.branchId, existing.id);
    if (value.branchId !== existing.branchId) this.mutateScope(value.branchId);
    const result = await this.repository.updateClient(
      this.scope(),
      existing.id,
      value,
      validateVersion(input.expectedUpdatedAt),
      this.access.auditContext(),
    );
    if (!result) throw new ResourceNotFoundError("Client");
    return result;
  }
  async createContact(input: CreateContactInput) {
    const value = validateContact(input);
    const client = await this.repository.getClient(
      this.scope(),
      value.clientId,
    );
    if (!client) throw new ResourceNotFoundError("Client");
    this.mutateScope(client.branchId, client.id);
    return this.repository.createContact(
      this.scope(),
      value,
      this.access.auditContext(),
    );
  }
  async updateContact(input: UpdateContactInput) {
    const value = validateContact(input);
    const contactId =
      typeof input.contactId === "string" ? input.contactId : "";
    const client = await this.repository.getClient(
      this.scope(),
      value.clientId,
    );
    if (!client) throw new ResourceNotFoundError("Client");
    this.mutateScope(client.branchId, client.id);
    const result = await this.repository.updateContact(
      this.scope(),
      contactId,
      value,
      validateVersion(input.expectedUpdatedAt),
      this.access.auditContext(),
    );
    if (!result) throw new ResourceNotFoundError("Contact");
    return result;
  }
  async createContract(input: CreateContractInput) {
    const value = validateContract(input);
    const client = await this.repository.getClient(
      this.scope(),
      value.clientId,
    );
    if (!client) throw new ResourceNotFoundError("Client");
    this.mutateScope(client.branchId, client.id);
    return this.repository.createContract(
      this.scope(),
      value,
      this.access.auditContext(),
    );
  }
  async updateContract(input: UpdateContractInput) {
    const value = validateContract(input);
    const contractId =
      typeof input.contractId === "string" ? input.contractId : "";
    const client = await this.repository.getClient(
      this.scope(),
      value.clientId,
    );
    if (!client) throw new ResourceNotFoundError("Client");
    this.mutateScope(client.branchId, client.id);
    const result = await this.repository.updateContract(
      this.scope(),
      contractId,
      value,
      validateVersion(input.expectedUpdatedAt),
      this.access.auditContext(),
    );
    if (!result) throw new ResourceNotFoundError("Contract");
    return result;
  }
}
