import type { CredentialJurisdiction } from "@/features/compliance-admin/canonical";
import type { QualificationReason } from "@/features/scheduling/qualification";

export type ComplianceWorkspaceCredential = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  branchId: string;
  branchName: string;
  definitionId: string;
  key: string;
  displayName: string;
  state:
    | "pending_verification"
    | "verified"
    | "expired"
    | "suspended"
    | "revoked"
    | "superseded";
  expiresOn?: string;
  jurisdiction: CredentialJurisdiction;
  warningDays: readonly number[];
};

export type ComplianceWorkspaceRequirement = {
  id: string;
  postId: string;
  definitionId: string;
  key: string;
  displayName: string;
  severity: "required" | "informational";
  jurisdiction: CredentialJurisdiction;
  effectiveStart: string;
  effectiveEnd?: string;
};

export type ComplianceWorkspaceAssignment = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  branchId: string;
  branchName: string;
  postId: string;
  siteId: string;
  siteName: string;
  postName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
};

export type ComplianceWorkspaceSources = {
  credentials: readonly ComplianceWorkspaceCredential[];
  requirements: readonly ComplianceWorkspaceRequirement[];
  assignments: readonly ComplianceWorkspaceAssignment[];
};

export type CompliancePriority =
  | "BLOCKING_ASSIGNMENT"
  | "EXPIRED_OR_RESTRICTED"
  | "MISSING_REQUIRED"
  | "PENDING_VERIFICATION"
  | "EXPIRING_SOON"
  | "INFORMATIONAL";

export type ComplianceWorkspaceItem = {
  id: string;
  priority: CompliancePriority;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  branchId: string;
  branchName: string;
  definitionId: string;
  credentialName: string;
  credentialState?: ComplianceWorkspaceCredential["state"];
  expiresOn?: string;
  jurisdiction?: string;
  reason?: QualificationReason;
  severity: "required" | "informational";
  actionStatus: string;
  href: string;
  assignment?: {
    id: string;
    siteId: string;
    siteName: string;
    postId: string;
    postName: string;
    startsAt: string;
    endsAt: string;
    href: string;
  };
};

export type ComplianceWorkspace = {
  items: readonly ComplianceWorkspaceItem[];
  summary: Readonly<Record<CompliancePriority, number>>;
};

export type ComplianceWorkspacePageState =
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | { kind: "ready"; workspace: ComplianceWorkspace };
