import type { VisibilityClassification } from "@/domain/model";

export const activityCategories = [
  "OBSERVATION",
  "ACCESS_CONTROL",
  "SAFETY_CHECK",
  "SAFETY_CONCERN",
  "REPORTABLE_INCIDENT",
  "CUSTOMER_SERVICE",
  "OTHER",
] as const;
export type ActivityCategory = (typeof activityCategories)[number];

export const incidentGateOutcomes = [
  "ROUTINE",
  "SUGGESTED",
  "REQUIRED",
] as const;
export type IncidentGateOutcome = (typeof incidentGateOutcomes)[number];

export type ActivityEntrySummary = {
  id: string;
  shiftAssignmentId: string;
  siteName: string;
  postName: string;
  occurredAt: string;
  category: ActivityCategory;
  locationContext?: string;
  narrative: string;
  actionTaken?: string;
  followUpRequired: boolean;
  visibility: VisibilityClassification;
  status: "SUBMITTED";
  createdAt: string;
  incidentGate: IncidentGateOutcome;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
};

export const incidentClassifications = [
  "SECURITY",
  "SAFETY",
  "ACCESS",
  "PROPERTY",
  "OTHER",
] as const;
export type IncidentClassification = (typeof incidentClassifications)[number];

export const incidentSeverities = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;
export type IncidentSeverity = (typeof incidentSeverities)[number];

export type IncidentReportSummary = {
  id: string;
  shiftAssignmentId: string;
  originatingActivityEntryId?: string;
  incidentNumber: string;
  classification: IncidentClassification;
  severity: IncidentSeverity;
  occurredAt: string;
  narrative: string;
  actionsTaken: string;
  emergencyServiceInvolvement: boolean;
  externalReportNumber?: string;
  status: "SUBMITTED";
  visibility: VisibilityClassification;
  createdAt: string;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
};

export type HandoffSummary = {
  id: string;
  shiftAssignmentId: string;
  siteName: string;
  postName: string;
  unresolvedIssues: readonly string[];
  equipmentKeyStatus: string;
  followUpItems: readonly string[];
  submittedAt: string;
  status: "SUBMITTED";
  visibility: VisibilityClassification;
  createdAt: string;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
};

export const operationalRecordTypes = [
  "ActivityEntry",
  "IncidentReport",
  "Handoff",
] as const;
export type OperationalRecordType = (typeof operationalRecordTypes)[number];
export type OperationalRevision = {
  revision: number;
  changedByUserId: string;
  changedByName?: string;
  changedAt: string;
  reason: string;
  snapshot: Record<string, unknown>;
};
export type ReviewRecord = {
  entityType: OperationalRecordType;
  id: string;
  organizationId: string;
  branchId: string;
  clientId: string;
  siteId: string;
  visibility: VisibilityClassification;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
  revision: number;
  snapshot: Record<string, unknown>;
  history: readonly OperationalRevision[];
};
export type AcknowledgeOperationalRecordInput = {
  entityType: unknown;
  recordId: unknown;
};
export type AmendOperationalRecordInput = {
  entityType: unknown;
  recordId: unknown;
  expectedRevision: unknown;
  reason: unknown;
  amendment: unknown;
  idempotencyKey: unknown;
};

export type CreateActivityInput = {
  shiftAssignmentId: unknown;
  category: unknown;
  occurredAt?: unknown;
  locationContext?: unknown;
  narrative: unknown;
  actionTaken?: unknown;
  followUpRequired?: unknown;
  visibility?: unknown;
  submissionKey: unknown;
};

export type CreateIncidentInput = {
  shiftAssignmentId: unknown;
  originatingActivityEntryId?: unknown;
  classification: unknown;
  severity: unknown;
  occurredAt?: unknown;
  narrative: unknown;
  actionsTaken: unknown;
  emergencyServiceInvolvement?: unknown;
  externalReportNumber?: unknown;
  visibility?: unknown;
  submissionKey: unknown;
};

export type CreateHandoffInput = {
  shiftAssignmentId: unknown;
  unresolvedIssues?: unknown;
  equipmentKeyStatus?: unknown;
  followUpItems?: unknown;
  visibility?: unknown;
  submissionKey: unknown;
};

export type ReportingPageState =
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      assignments: readonly ActivityAssignment[];
      recent: readonly ActivityEntrySummary[];
      incidents: readonly IncidentReportSummary[];
      handoffs: readonly HandoffSummary[];
      reviewEnabled?: boolean;
    };

export type ActivityAssignment = {
  id: string;
  siteName: string;
  postName: string;
  scheduledStart: string;
  scheduledEnd: string;
};
