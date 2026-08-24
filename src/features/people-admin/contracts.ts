import type { LifecycleStatus } from "@/features/client-admin/contracts";

export type EmployeeSummary = {
  id: string;
  employeeNumber: string;
  displayName: string;
  workPhone?: string;
  employmentStatus: LifecycleStatus;
  primaryBranchId: string;
  primaryBranchName: string;
  user?: { id: string; email: string; status: LifecycleStatus };
  updatedAt: string;
};

export type EmployeePage = {
  items: readonly EmployeeSummary[];
  hasMore: boolean;
};
export type BranchOption = { id: string; name: string; timezone: string };
export type UserOption = { id: string; email: string; status: LifecycleStatus };

export type CreateEmployeeInput = {
  employeeNumber: unknown;
  displayName: unknown;
  workPhone: unknown;
  employmentStatus: unknown;
  primaryBranchId: unknown;
  userId: unknown;
};
export type UpdateEmployeeInput = CreateEmployeeInput & {
  employeeId: unknown;
  expectedUpdatedAt: unknown;
};

export type PeopleAdminPageState =
  | { kind: "loading" }
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      canManage: boolean;
      branches: readonly BranchOption[];
      employees: EmployeePage;
      users: readonly UserOption[];
      detail?: EmployeeSummary;
    };
