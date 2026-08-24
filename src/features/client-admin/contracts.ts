export const lifecycleStatuses = ["active", "inactive"] as const;
export type LifecycleStatus = (typeof lifecycleStatuses)[number];
export const contractStatuses = [
  "draft",
  "active",
  "expired",
  "terminated",
] as const;
export type ContractStatus = (typeof contractStatuses)[number];

export type ClientSummary = {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  status: LifecycleStatus;
  updatedAt: string;
};
export type ContactSummary = {
  id: string;
  clientId: string;
  name: string;
  email?: string;
  phone?: string;
  status: LifecycleStatus;
  updatedAt: string;
};
export type ContractSummary = {
  id: string;
  clientId: string;
  name: string;
  startsOn: string;
  endsOn?: string;
  status: ContractStatus;
  updatedAt: string;
};
export type BranchOption = { id: string; name: string; timezone: string };
export type ClientPage = { items: readonly ClientSummary[]; hasMore: boolean };
export type ClientDetail = {
  client: ClientSummary;
  contacts: readonly ContactSummary[];
  contracts: readonly ContractSummary[];
};

export type CreateClientInput = {
  branchId: unknown;
  name: unknown;
  status: unknown;
};
export type UpdateClientInput = CreateClientInput & {
  clientId: unknown;
  expectedUpdatedAt: unknown;
};
export type CreateContactInput = {
  clientId: unknown;
  name: unknown;
  email: unknown;
  phone: unknown;
  status: unknown;
};
export type UpdateContactInput = CreateContactInput & {
  contactId: unknown;
  expectedUpdatedAt: unknown;
};
export type CreateContractInput = {
  clientId: unknown;
  name: unknown;
  startsOn: unknown;
  endsOn: unknown;
  status: unknown;
};
export type UpdateContractInput = CreateContractInput & {
  contractId: unknown;
  expectedUpdatedAt: unknown;
};

export type ClientAdminPageState =
  | { kind: "loading" }
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      canMutate: boolean;
      branches: readonly BranchOption[];
      clients: ClientPage;
      detail?: ClientDetail;
    };
