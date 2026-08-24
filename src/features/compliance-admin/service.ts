import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  InvariantViolationError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type {
  ComplianceKind,
  CreateComplianceInput,
  RenewComplianceInput,
  UpdateComplianceInput,
} from "./contracts";
import type {
  ComplianceAdminRepository,
  TrustedComplianceScope,
} from "./repository";
import {
  validateCompliance,
  validateRenewCompliance,
  validateUpdateCompliance,
  validateVersion,
} from "./validation";
export class ComplianceAdminService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: ComplianceAdminRepository,
  ) {}
  private scope(): TrustedComplianceScope {
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
  async listEmployees() {
    this.read();
    return this.repository.listEmployees(this.scope());
  }
  async getEmployeeDetail(employeeId: string) {
    this.read();
    const detail = await this.repository.getEmployeeDetail(
      this.scope(),
      employeeId,
    );
    if (!detail) throw new ResourceNotFoundError("Employee");
    this.read(detail.employee.branchId);
    return detail;
  }
  async create(kind: ComplianceKind, input: CreateComplianceInput) {
    const value = validateCompliance(input);
    if (value.status === "active")
      throw new InvariantViolationError(
        "Use the verification action to activate a new compliance record.",
      );
    const detail = await this.getEmployeeDetail(value.employeeId);
    this.manage(detail.employee.branchId);
    return this.repository.create(
      this.scope(),
      kind,
      value,
      this.access.auditContext(),
    );
  }
  async update(kind: ComplianceKind, input: UpdateComplianceInput) {
    const value = validateUpdateCompliance(input);
    const existing = await this.repository.getRecord(
      this.scope(),
      kind,
      value.recordId,
    );
    if (!existing)
      throw new ResourceNotFoundError(
        kind === "credential" ? "Credential" : "Certification",
      );
    if (value.status === "active" && existing.status !== "active")
      throw new InvariantViolationError(
        "Use the verification action to activate a pending compliance record.",
      );
    const detail = await this.getEmployeeDetail(existing.employeeId);
    this.manage(detail.employee.branchId);
    if (value.employeeId !== existing.employeeId)
      throw new ResourceNotFoundError("Employee");
    const result = await this.repository.update(
      this.scope(),
      kind,
      existing.id,
      value,
      value.expectedUpdatedAt,
      this.access.auditContext(),
    );
    if (!result)
      throw new ResourceNotFoundError(
        kind === "credential" ? "Credential" : "Certification",
      );
    return result;
  }
  async verify(
    kind: ComplianceKind,
    recordId: string,
    expectedUpdatedAt: unknown,
  ) {
    const expected = validateVersion(expectedUpdatedAt);
    const existing = await this.repository.getRecord(
      this.scope(),
      kind,
      recordId,
    );
    if (!existing)
      throw new ResourceNotFoundError(
        kind === "credential" ? "Credential" : "Certification",
      );
    const detail = await this.getEmployeeDetail(existing.employeeId);
    this.manage(detail.employee.branchId);
    const result = await this.repository.verify(
      this.scope(),
      kind,
      recordId,
      expected,
      this.access.auditContext(),
    );
    if (!result)
      throw new ResourceNotFoundError(
        kind === "credential" ? "Credential" : "Certification",
      );
    return result;
  }
  async renew(kind: ComplianceKind, input: RenewComplianceInput) {
    const value = validateRenewCompliance(input);
    const existing = await this.repository.getRecord(
      this.scope(),
      kind,
      value.predecessorId,
    );
    if (!existing || existing.employeeId !== value.employeeId)
      throw new ResourceNotFoundError(
        kind === "credential" ? "Credential" : "Certification",
      );
    const detail = await this.getEmployeeDetail(existing.employeeId);
    this.manage(detail.employee.branchId);
    return this.repository.create(
      this.scope(),
      kind,
      value,
      this.access.auditContext(),
      existing.id,
    );
  }
}
