import type { AuditContext } from "@/server/request/boundary";
import type {
  ComplianceDetail,
  ComplianceKind,
  ComplianceSummary,
  EmployeeComplianceOption,
} from "./contracts";
export const EMPLOYEE_OPTION_LIMIT = 100;
export const COMPLIANCE_HISTORY_LIMIT = 100;
export type TrustedComplianceScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
};
export type ComplianceMutation = {
  employeeId: string;
  type: string;
  identifier?: string;
  issuingAuthority: string;
  issuedOn: string;
  expiresOn?: string;
  status: ComplianceSummary["status"];
  documentReference?: string;
};
export interface ComplianceAdminRepository {
  listEmployees(
    scope: TrustedComplianceScope,
  ): Promise<readonly EmployeeComplianceOption[]>;
  getEmployeeDetail(
    scope: TrustedComplianceScope,
    employeeId: string,
  ): Promise<ComplianceDetail | null>;
  getRecord(
    scope: TrustedComplianceScope,
    kind: ComplianceKind,
    recordId: string,
  ): Promise<ComplianceSummary | null>;
  create(
    scope: TrustedComplianceScope,
    kind: ComplianceKind,
    input: ComplianceMutation,
    audit: AuditContext,
    predecessorId?: string,
  ): Promise<ComplianceSummary>;
  update(
    scope: TrustedComplianceScope,
    kind: ComplianceKind,
    recordId: string,
    input: ComplianceMutation,
    expected: string,
    audit: AuditContext,
  ): Promise<ComplianceSummary | null>;
  verify(
    scope: TrustedComplianceScope,
    kind: ComplianceKind,
    recordId: string,
    expected: string,
    audit: AuditContext,
  ): Promise<ComplianceSummary | null>;
}
