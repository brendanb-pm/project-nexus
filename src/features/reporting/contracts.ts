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

export type ReportingPageState =
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      assignments: readonly ActivityAssignment[];
      recent: readonly ActivityEntrySummary[];
    };

export type ActivityAssignment = {
  id: string;
  siteName: string;
  postName: string;
  scheduledStart: string;
  scheduledEnd: string;
};
