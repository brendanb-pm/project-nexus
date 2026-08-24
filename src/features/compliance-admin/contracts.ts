export const complianceStatuses = [
  "active",
  "expired",
  "suspended",
  "revoked",
  "pending_verification",
] as const;
export type ComplianceStatus = (typeof complianceStatuses)[number];
export type ComplianceKind = "credential" | "certification";
export type ComplianceSummary = {
  id: string;
  employeeId: string;
  kind: ComplianceKind;
  type: string;
  identifier?: string;
  issuingAuthority: string;
  issuedOn: string;
  expiresOn?: string;
  status: ComplianceStatus;
  documentReference?: string;
  predecessorId?: string;
  verifiedAt?: string;
  updatedAt: string;
};
export type EmployeeComplianceOption = {
  id: string;
  employeeNumber: string;
  displayName: string;
  branchId: string;
  branchName: string;
  employmentStatus: "active" | "inactive";
};
export type ComplianceDetail = {
  employee: EmployeeComplianceOption;
  credentials: readonly ComplianceSummary[];
  certifications: readonly ComplianceSummary[];
};
export type CreateComplianceInput = {
  employeeId: unknown;
  type: unknown;
  identifier?: unknown;
  issuingAuthority: unknown;
  issuedOn: unknown;
  expiresOn: unknown;
  status: unknown;
  documentReference: unknown;
};
export type UpdateComplianceInput = CreateComplianceInput & {
  recordId: unknown;
  expectedUpdatedAt: unknown;
};
export type RenewComplianceInput = CreateComplianceInput & {
  predecessorId: unknown;
};
export type ComplianceAdminPageState =
  | { kind: "loading" }
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      canManage: boolean;
      employees: readonly EmployeeComplianceOption[];
      detail?: ComplianceDetail;
    };
