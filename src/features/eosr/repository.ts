import type { AuditContext } from "@/server/request/boundary";
import type {
  ReportingScope,
  ActivityContext,
} from "@/features/reporting/repository";
import type {
  EndOfShiftReport,
  IncomingPassdown,
  ShiftCloseStatus,
} from "./contracts";

export interface EndOfShiftReportRepository {
  getAssignment(
    scope: ReportingScope,
    assignmentId: string,
  ): Promise<ActivityContext | null>;
  create(
    scope: ReportingScope,
    context: ActivityContext,
    input: Omit<
      EndOfShiftReport,
      | "id"
      | "siteName"
      | "postName"
      | "submittedAt"
      | "acknowledgedByUserId"
      | "acknowledgedAt"
    > & { submissionKey: string },
    audit: AuditContext,
  ): Promise<EndOfShiftReport>;
  listIncomingPassdowns(
    scope: ReportingScope,
    employeeId: string,
    actorUserId: string,
    now: string,
    limit: number,
  ): Promise<readonly IncomingPassdown[]>;
  setPassdownDismissal(
    scope: ReportingScope,
    passdown: IncomingPassdown,
    actorUserId: string,
    dismissed: boolean,
    at: string,
    audit: AuditContext,
  ): Promise<IncomingPassdown>;
  listShiftClose(
    scope: ReportingScope,
    now: string,
    limit: number,
  ): Promise<readonly ShiftCloseStatus[]>;
}
