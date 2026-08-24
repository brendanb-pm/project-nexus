import type { AuditContext } from "@/server/request/boundary";
import type {
  BranchOption,
  ClientDetail,
  ClientPage,
  ClientSummary,
  ContactSummary,
  ContractSummary,
  LifecycleStatus,
  ContractStatus,
} from "./contracts";

export const CLIENT_PAGE_SIZE = 25;
export const RELATED_LIMIT = 100;
export type TrustedScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
  clientIds: readonly string[];
};
export type ClientMutation = {
  branchId: string;
  name: string;
  status: LifecycleStatus;
};
export type ContactMutation = {
  clientId: string;
  name: string;
  email?: string;
  phone?: string;
  status: LifecycleStatus;
};
export type ContractMutation = {
  clientId: string;
  name: string;
  startsOn: string;
  endsOn?: string;
  status: ContractStatus;
};

export interface ClientAdminRepository {
  listBranches(scope: TrustedScope): Promise<readonly BranchOption[]>;
  listClients(scope: TrustedScope, limit: number): Promise<ClientPage>;
  getClient(
    scope: TrustedScope,
    clientId: string,
  ): Promise<ClientSummary | null>;
  getClientDetail(
    scope: TrustedScope,
    clientId: string,
  ): Promise<ClientDetail | null>;
  createClient(
    scope: TrustedScope,
    input: ClientMutation,
    audit: AuditContext,
  ): Promise<ClientSummary>;
  updateClient(
    scope: TrustedScope,
    clientId: string,
    input: ClientMutation,
    expected: string,
    audit: AuditContext,
  ): Promise<ClientSummary | null>;
  createContact(
    scope: TrustedScope,
    input: ContactMutation,
    audit: AuditContext,
  ): Promise<ContactSummary>;
  updateContact(
    scope: TrustedScope,
    contactId: string,
    input: ContactMutation,
    expected: string,
    audit: AuditContext,
  ): Promise<ContactSummary | null>;
  createContract(
    scope: TrustedScope,
    input: ContractMutation,
    audit: AuditContext,
  ): Promise<ContractSummary>;
  updateContract(
    scope: TrustedScope,
    contractId: string,
    input: ContractMutation,
    expected: string,
    audit: AuditContext,
  ): Promise<ContractSummary | null>;
}
