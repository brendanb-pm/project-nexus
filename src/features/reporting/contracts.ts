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

export type ReportingPageState =
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      assignments: readonly ActivityAssignment[];
      recent: readonly ActivityEntrySummary[];
      incidents: readonly IncidentReportSummary[];
    };

export type ActivityAssignment = {
  id: string;
  siteName: string;
  postName: string;
  scheduledStart: string;
  scheduledEnd: string;
};
