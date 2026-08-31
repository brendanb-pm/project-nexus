import type { AuditContext } from "@/server/request/boundary";
import type { VisibilityClassification } from "@/domain/model";
import type {
  ActivityAssignment,
  ActivityEntrySummary,
  ActivityCategory,
  IncidentClassification,
  IncidentReportSummary,
  IncidentSeverity,
  HandoffSummary,
  ReviewRecord,
} from "./contracts";

export type ReportingScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
  clientIds: readonly string[];
  siteIds: readonly string[];
};
export type ActivityContext = ActivityAssignment & {
  organizationId: string;
  branchId: string;
  clientId: string;
  siteId: string;
  postId: string;
  employeeId: string;
  assignmentStatus: "assigned" | "confirmed" | "cancelled";
};
export type NewActivity = {
  category: ActivityCategory;
  occurredAt: string;
  locationContext?: string;
  narrative: string;
  actionTaken?: string;
  followUpRequired: boolean;
  visibility: VisibilityClassification;
  submissionKey: string;
};

export type NewIncident = {
  originatingActivityEntryId?: string;
  classification: IncidentClassification;
  severity: IncidentSeverity;
  occurredAt: string;
  narrative: string;
  actionsTaken: string;
  emergencyServiceInvolvement: boolean;
  externalReportNumber?: string;
  visibility: VisibilityClassification;
  submissionKey: string;
};
export type NewHandoff = {
  unresolvedIssues: readonly string[];
  equipmentKeyStatus: string;
  followUpItems: readonly string[];
  submittedAt: string;
  visibility: VisibilityClassification;
  submissionKey: string;
};

export interface ReportingRepository {
  getReviewRecord(
    scope: ReportingScope,
    entityType: "ActivityEntry" | "IncidentReport" | "Handoff",
    id: string,
    historyLimit: number,
  ): Promise<ReviewRecord | null>;
  acknowledgeReviewRecord(
    scope: ReportingScope,
    record: ReviewRecord,
    actorUserId: string,
    acknowledgedAt: string,
    audit: AuditContext,
  ): Promise<ReviewRecord>;
  amendReviewRecord(
    scope: ReportingScope,
    record: ReviewRecord,
    expectedRevision: number,
    reason: string,
    amendment: Record<string, unknown>,
    idempotencyKey: string,
    actorUserId: string,
    changedAt: string,
    audit: AuditContext,
  ): Promise<ReviewRecord | null>;
  listOwnAssignments(
    scope: ReportingScope,
    employeeId: string,
    limit: number,
  ): Promise<readonly ActivityAssignment[]>;
  getActivityContext(
    scope: ReportingScope,
    assignmentId: string,
  ): Promise<ActivityContext | null>;
  listRecent(
    scope: ReportingScope,
    employeeId: string,
    limit: number,
  ): Promise<readonly ActivityEntrySummary[]>;
  listReviewActivities(
    scope: ReportingScope,
    visibility: readonly VisibilityClassification[],
    limit: number,
  ): Promise<readonly ActivityEntrySummary[]>;
  createActivity(
    scope: ReportingScope,
    context: ActivityContext,
    input: NewActivity,
    audit: AuditContext,
  ): Promise<ActivityEntrySummary>;
  listOwnIncidents(
    scope: ReportingScope,
    employeeId: string,
    limit: number,
  ): Promise<readonly IncidentReportSummary[]>;
  listIncidents(
    scope: ReportingScope,
    visibility: readonly VisibilityClassification[],
    limit: number,
  ): Promise<readonly IncidentReportSummary[]>;
  getOriginatingActivity(
    scope: ReportingScope,
    context: ActivityContext,
    activityEntryId: string,
  ): Promise<ActivityEntrySummary | null>;
  createIncident(
    scope: ReportingScope,
    context: ActivityContext,
    input: NewIncident,
    audit: AuditContext,
  ): Promise<IncidentReportSummary>;
  listOwnHandoffs(
    scope: ReportingScope,
    employeeId: string,
    limit: number,
  ): Promise<readonly HandoffSummary[]>;
  listReviewHandoffs(
    scope: ReportingScope,
    visibility: readonly VisibilityClassification[],
    limit: number,
  ): Promise<readonly HandoffSummary[]>;
  createHandoff(
    scope: ReportingScope,
    context: ActivityContext,
    input: NewHandoff,
    audit: AuditContext,
  ): Promise<HandoffSummary>;
}
