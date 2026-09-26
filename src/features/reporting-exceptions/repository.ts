import type { AuditContext } from "@/server/request/boundary";
import type { ReportingScope } from "@/features/reporting/repository";
import type {
  ReportingExceptionDossier,
  ReportingExceptionDetail,
  ReportingExceptionSummary,
  ReportingExceptionTransition,
} from "./contracts";

export type ReportingExceptionScope = ReportingScope;

export interface ReportingExceptionRepository {
  reconcile(scope: ReportingExceptionScope, now: string): Promise<void>;
  list(
    scope: ReportingExceptionScope,
    options: { employeeId?: string; limit: number },
  ): Promise<readonly ReportingExceptionSummary[]>;
  detail(
    scope: ReportingExceptionScope,
    id: string,
  ): Promise<ReportingExceptionDetail | null>;
  dossier(
    scope: ReportingExceptionScope,
    id: string,
  ): Promise<ReportingExceptionDossier | null>;
  transition(
    scope: ReportingExceptionScope,
    input: ReportingExceptionTransition,
    audit: AuditContext,
  ): Promise<ReportingExceptionDetail | null>;
}
