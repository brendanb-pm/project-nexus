export const reportingObligationTypes = [
  "EOSR",
  "ACTIVITY_ENTRY",
  "INCIDENT_REPORT",
] as const;
export type ReportingObligationType = (typeof reportingObligationTypes)[number];

export const reportingExceptionStates = [
  "OPEN",
  "ACKNOWLEDGED",
  "CORRECTION_REQUESTED",
  "CORRECTED_PENDING_REVIEW",
  "RESOLVED",
  "ESCALATED",
  "WAIVED",
] as const;
export type ReportingExceptionState = (typeof reportingExceptionStates)[number];

export type ReportingExceptionClassification = "LATE" | "MISSING";

export type ReportingObligation = {
  key: string;
  type: ReportingObligationType;
  assignmentId: string;
  triggeringActivityEntryId?: string;
  dueAt: string;
  effectiveShiftEndAt: string;
  classification: ReportingExceptionClassification;
  fulfilledAt?: string;
};

export type ReportingExceptionSummary = {
  id: string;
  organizationId: string;
  assignmentId: string;
  employeeId: string;
  branchId: string;
  clientId: string;
  siteId: string;
  postId: string;
  obligationType: ReportingObligationType;
  classification: ReportingExceptionClassification;
  state: ReportingExceptionState;
  dueAt: string;
  effectiveShiftEndAt: string;
  firstDetectedAt: string;
  correctedAt?: string;
  resolvedAt?: string;
  assigneeUserId?: string;
  revision: number;
  sourceHref: string;
};

export type ReportingExceptionEvent = {
  id: string;
  previousState?: ReportingExceptionState;
  nextState: ReportingExceptionState;
  reason: string;
  actor: "SYSTEM" | "USER";
  actorUserId?: string;
  assigneeUserId?: string;
  occurredAt: string;
};

export type ReportingExceptionDetail = {
  exception: ReportingExceptionSummary;
  history: readonly ReportingExceptionEvent[];
};

export type ReportingExceptionDossier = ReportingExceptionDetail & {
  context: {
    clientName: string;
    siteName: string;
    siteTimezone: string;
    postName: string;
    employeeNumber: string;
    employeeEmail?: string;
    scheduledStart: string;
    scheduledEnd: string;
    assignmentStatus: string;
  };
  evidence: {
    activities: readonly {
      id: string;
      category: string;
      occurredAt: string;
      incidentGate: string;
    }[];
    incidents: readonly {
      id: string;
      incidentNumber: string;
      occurredAt: string;
      classification: string;
      severity: string;
    }[];
    closeout?: { id: string; submittedAt: string };
    clockOutAt?: string;
    activityHasMore: boolean;
    incidentHasMore: boolean;
  };
  actors: Readonly<Record<string, string>>;
};

export type ReportingExceptionTransition = {
  exceptionId: string;
  nextState: ReportingExceptionState;
  reason: string;
  expectedRevision: number;
  assigneeUserId?: string;
};

export const terminalExceptionStates = new Set<ReportingExceptionState>([
  "RESOLVED",
  "WAIVED",
]);
