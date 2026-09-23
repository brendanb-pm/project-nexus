export const reportHubFamilies = [
  "activity",
  "incident",
  "eosr",
  "exception",
] as const;
export type ReportHubFamily = (typeof reportHubFamilies)[number];

export const reportHubWindows = [24, 168, 720] as const;
export type ReportHubWindowHours = (typeof reportHubWindows)[number];

export const reportHubStatuses = [
  "DRAFT",
  "SUBMITTED",
  "ACKNOWLEDGED",
  "APPROVED",
  "AMENDED",
  "OPEN",
  "CORRECTION_REQUESTED",
  "CORRECTED_PENDING_REVIEW",
  "RESOLVED",
  "ESCALATED",
  "WAIVED",
] as const;
export type ReportHubStatus = (typeof reportHubStatuses)[number];

export type ReportHubFilters = {
  siteId?: string;
  family?: ReportHubFamily;
  status?: ReportHubStatus;
  windowHours: ReportHubWindowHours;
  cursor?: string;
};

export type ReportHubSite = { id: string; name: string };

export type ReportHubRow = {
  id: string;
  family: ReportHubFamily;
  familyLabel: string;
  siteId: string;
  siteName: string;
  postName: string;
  timestamp: string;
  status: string;
  summary: string;
  href: string;
};

export type InternalReportHub = {
  kind: "internal";
  scopeLabel: "Organization" | "Authorized portfolio";
  sites: readonly ReportHubSite[];
  sitesLimited: boolean;
  filters: ReportHubFilters;
  rows: readonly ReportHubRow[];
  hasMore: boolean;
  nextCursor?: string;
};

export type ReportHubPageState =
  | InternalReportHub
  | { kind: "guard" }
  | { kind: "client" }
  | { kind: "leadership" }
  | { kind: "denied" }
  | { kind: "error"; message: string };
