import { AuthorizedDataAccess } from "@/server/request/boundary";
import { ResourceNotFoundError } from "@/server/request/errors";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "./contracts";
import {
  EMPLOYEE_PAGE_SIZE,
  type PeopleAdminRepository,
  type TrustedEmployeeScope,
} from "./repository";
import { validateEmployee, validateUpdateEmployee } from "./validation";

export class PeopleAdminService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: PeopleAdminRepository,
  ) {}
  private scope(): TrustedEmployeeScope {
    const c = this.access.context;
    return {
      organizationId: c.organizationId,
      organizationWide: c.scope.organizationWide,
      branchIds: c.scope.branchIds,
    };
  }
  private read(branchId?: string) {
    this.access.requireAnyHierarchical(
      ["VIEW_EMPLOYEE_COMPLIANCE", "MANAGE_EMPLOYEES"],
      { organizationId: this.access.context.organizationId, branchId },
    );
  }
  private manage(branchId?: string) {
    this.access.requireHierarchical("MANAGE_EMPLOYEES", {
      organizationId: this.access.context.organizationId,
      branchId,
    });
  }
  canManage() {
    return this.access.context.capabilities.has("MANAGE_EMPLOYEES");
  }
  async listBranches() {
    this.read();
    return this.repository.listBranches(this.scope());
  }
  async listEmployees() {
    this.read();
    return this.repository.listEmployees(this.scope(), EMPLOYEE_PAGE_SIZE);
  }
  async listLinkableUsers() {
    this.manage();
    return this.repository.listLinkableUsers(this.scope());
  }
  async getEmployee(id: string) {
    this.read();
    const employee = await this.repository.getEmployee(this.scope(), id);
    if (!employee) throw new ResourceNotFoundError("Employee");
    this.read(employee.primaryBranchId);
    return employee;
  }
  async createEmployee(input: CreateEmployeeInput) {
    const value = validateEmployee(input);
    this.manage(value.primaryBranchId);
    return this.repository.createEmployee(
      this.scope(),
      value,
      this.access.auditContext(),
    );
  }
  async updateEmployee(input: UpdateEmployeeInput) {
    const value = validateUpdateEmployee(input);
    const existing = await this.repository.getEmployee(
      this.scope(),
      value.employeeId,
    );
    if (!existing) throw new ResourceNotFoundError("Employee");
    this.manage(existing.primaryBranchId);
    this.manage(value.primaryBranchId);
    const result = await this.repository.updateEmployee(
      this.scope(),
      existing.id,
      value,
      value.expectedUpdatedAt,
      this.access.auditContext(),
    );
    if (!result) throw new ResourceNotFoundError("Employee");
    return result;
  }
}
