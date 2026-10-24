import type { AuditContext } from "@/server/request/boundary";
import type { ReportingScope } from "@/features/reporting/repository";
import type {
  ClientReportCandidate,
  ClientReportCompositionOption,
  ClientReportDraft,
  ClientReportPublication,
  PublishClientReportInput,
} from "./contracts";
import type { validateDraft } from "./service";

export type ValidatedDraft = ReturnType<typeof validateDraft>;

export interface ClientPublicationRepository {
  compositionOptions(
    scope: ReportingScope,
  ): Promise<readonly ClientReportCompositionOption[]>;
  candidates(
    scope: ReportingScope,
    clientId: string,
    siteId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<readonly ClientReportCandidate[]>;
  saveDraft(
    scope: ReportingScope,
    input: ValidatedDraft,
    audit: AuditContext,
  ): Promise<ClientReportDraft>;
  listDrafts(scope: ReportingScope): Promise<readonly ClientReportDraft[]>;
  draft(scope: ReportingScope, id: string): Promise<ClientReportDraft | null>;
  publish(
    scope: ReportingScope,
    input: PublishClientReportInput,
    audit: AuditContext,
  ): Promise<ClientReportPublication>;
  listPublished(
    scope: ReportingScope,
  ): Promise<readonly ClientReportPublication[]>;
  publication(
    scope: ReportingScope,
    id: string,
  ): Promise<ClientReportPublication | null>;
}
