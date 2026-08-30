import type { AuditContext } from "@/server/request/boundary";
import type { VisibilityClassification } from "@/domain/model";
import type {
  ActivityAssignment,
  ActivityEntrySummary,
  ActivityCategory,
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

export interface ReportingRepository {
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
  createActivity(
    scope: ReportingScope,
    context: ActivityContext,
    input: NewActivity,
    audit: AuditContext,
  ): Promise<ActivityEntrySummary>;
}
