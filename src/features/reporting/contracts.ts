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
  authorUserId?: string;
  authorName?: string;
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
  siteName?: string;
  postName?: string;
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
  authorUserId?: string;
  authorName?: string;
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
  authorUserId?: string;
  authorName?: string;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
};

/** The only primary reporting choices exposed to a Guard. */
export const guardFacingReportTypes = [
  "ShiftReport",
  "SecurityIncidentReport",
] as const;
export type GuardFacingReportType = (typeof guardFacingReportTypes)[number];

/**
 * Shift Report is a composed read model: ActivityEntry records form its
 * timeline and EOSR supplies its final closeout state.
 */
export const shiftReportRecordTypes = [
  "ActivityEntry",
  "EndOfShiftReport",
] as const;
export type ShiftReportCloseout = {
  id: string;
  summary: string;
  unresolvedIssues: readonly string[];
  equipmentAccessStatus: string;
  followUpItems: readonly string[];
  unusualConditions: string;
  submittedAt: string;
  acknowledgedAt?: string;
};
export type ShiftReportReadModel = {
  assignment: ActivityAssignment;
  timeline: readonly ActivityEntrySummary[];
  incidents: readonly IncidentReportSummary[];
  closeout?: ShiftReportCloseout;
};

/**
 * Historical Handoffs remain reviewable, but EOSR is the sole end-of-shift
 * submission path. Handoff is intentionally excluded from guard-facing
 * reporting taxonomy.
 */
export const legacyReportingRecordTypes = ["Handoff"] as const;

/**
 * `daily_activity_reports` is retained only as legacy evidence. ActivityEntry
 * is the authoritative DAR path; do not add a writer or read-model authority
 * for this table without an approved follow-up decision.
 */
export const dailyActivityReportDisposition = {
  table: "daily_activity_reports",
  authority: "LEGACY_EVIDENCE_ONLY",
  canonicalReplacement: "ActivityEntry",
  writePolicy: "NO_NEW_WRITERS",
} as const;

/** Includes legacy Handoff solely for historical review and amendment. */
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
  acknowledgedByName?: string;
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

export type CreateActivityResult =
  | { kind: "confirmed"; entry: ActivityEntrySummary }
  | {
      kind: "validation-error";
      fieldErrors: Readonly<Record<string, readonly string[]>>;
    }
  | { kind: "rejected"; message: string };

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

export type ReportingPageState =
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      assignments: readonly ActivityAssignment[];
      recent: readonly ActivityEntrySummary[];
      incidents: readonly IncidentReportSummary[];
      handoffs: readonly HandoffSummary[];
      timelineHasMore?: boolean;
      reviewEnabled?: boolean;
    };

export type ActivityAssignment = {
  id: string;
  siteName: string;
  postName: string;
  scheduledStart: string;
  scheduledEnd: string;
};
