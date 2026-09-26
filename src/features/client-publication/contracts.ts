export type ClientReportSource = {
  kind: "ACTIVITY" | "INCIDENT";
  id: string;
  clientSummary: string;
};

export type ClientReportDraftInput = {
  clientId: string;
  siteIds: readonly string[];
  periodStart: string;
  periodEnd: string;
  executiveSummary: string;
  completionSummary: string;
  followUps: readonly string[];
  selectedSources: readonly ClientReportSource[];
  expectedRevision?: number;
};

export type ClientReportDraft = ClientReportDraftInput & {
  id: string;
  revision: number;
  latestVersion: number;
};

export type ClientReportSnapshot = {
  clientId: string;
  clientName: string;
  sites: readonly { id: string; name: string }[];
  periodStart: string;
  periodEnd: string;
  executiveSummary: string;
  completionSummary: string;
  followUps: readonly string[];
  sources: readonly (
    | {
        kind: "ACTIVITY";
        id: string;
        siteId: string;
        occurredAt: string;
        category: string;
        clientSummary: string;
      }
    | {
        kind: "INCIDENT";
        id: string;
        siteId: string;
        occurredAt: string;
        incidentNumber: string;
        classification: string;
        severity: string;
        clientSummary: string;
      }
  )[];
};

export type ClientReportPublication = {
  id: string;
  clientId: string;
  siteIds: readonly string[];
  version: number;
  supersedesId?: string;
  publishedAt: string;
  snapshot: ClientReportSnapshot;
};

export type PublishClientReportInput = {
  draftId: string;
  expectedDraftRevision: number;
  expectedVersion: number;
  confirmationKey: string;
  confirmed: boolean;
};

export type ClientReportCompositionOption = {
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
};

export type ClientReportCandidate = {
  kind: "ACTIVITY" | "INCIDENT";
  id: string;
  occurredAt: string;
  label: string;
};
