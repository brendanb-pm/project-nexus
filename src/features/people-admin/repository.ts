import type { AuditContext } from "@/server/request/boundary";
import type {
  BranchOption,
  EmployeePage,
  EmployeeSummary,
  UserOption,
} from "./contracts";
import type { LifecycleStatus } from "@/features/client-admin/contracts";

export const EMPLOYEE_PAGE_SIZE = 25;
export const USER_OPTION_LIMIT = 100;
export type TrustedEmployeeScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
};
export type EmployeeMutation = {
  employeeNumber: string;
  displayName: string;
  workPhone?: string;
  employmentStatus: LifecycleStatus;
  primaryBranchId: string;
  userId?: string;
};
export interface PeopleAdminRepository {
  listBranches(scope: TrustedEmployeeScope): Promise<readonly BranchOption[]>;
  listEmployees(
    scope: TrustedEmployeeScope,
    limit: number,
  ): Promise<EmployeePage>;
  listLinkableUsers(
    scope: TrustedEmployeeScope,
  ): Promise<readonly UserOption[]>;
  getEmployee(
    scope: TrustedEmployeeScope,
    id: string,
  ): Promise<EmployeeSummary | null>;
  createEmployee(
    scope: TrustedEmployeeScope,
    input: EmployeeMutation,
    audit: AuditContext,
  ): Promise<EmployeeSummary>;
  updateEmployee(
    scope: TrustedEmployeeScope,
    id: string,
    input: EmployeeMutation,
    expected: string,
    audit: AuditContext,
  ): Promise<EmployeeSummary | null>;
}
