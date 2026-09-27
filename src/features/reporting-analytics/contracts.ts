export type AnalyticsScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
  clientIds: readonly string[];
  siteIds: readonly string[];
};

export type AnalyticsFilters = {
  windowHours: 24 | 168 | 720;
  sitePage?: number;
  branchId?: string;
  clientId?: string;
  siteId?: string;
  incidentClassification?: string;
  incidentSeverity?: string;
  incidentStatus?: "SUBMITTED" | "ACKNOWLEDGED" | "APPROVED" | "AMENDED";
};

export type AnalyticsLocation = {
  siteId: string;
  siteName: string;
  timezone: string;
  clientId: string;
  clientName: string;
  branchId: string | null;
  branchName: string | null;
};

export type AssignmentAggregate = AnalyticsLocation & {
  eligible: number;
  due: number;
  completed: number;
  eosrOnly: number;
  onTimeCloseout: number;
  activitySatisfied: number;
  activityDueSatisfied: number;
};

export type IncidentAggregate = AnalyticsLocation & {
  classification: string;
  severity: string;
  count: number;
};

export type ExceptionAggregate = AnalyticsLocation & {
  state: string;
  count: number;
  openCount: number;
  ageHours: number;
  turnaroundHours: number;
  turnaroundCount: number;
};

export type AnalyticsSources = {
  assignments: readonly AssignmentAggregate[];
  incidents: readonly IncidentAggregate[];
  exceptions: readonly ExceptionAggregate[];
};

export type AnalyticsMetric = {
  numerator: number;
  denominator: number;
  percent: number | null;
};

export type AnalyticsRollup = {
  key: string;
  label: string;
  shiftReportCompletion: AnalyticsMetric;
  onTimeCloseout: AnalyticsMetric;
  activityCoverage: AnalyticsMetric;
  eosrOnlyCount: number;
  incidentCount: number;
  incidentDistribution: readonly {
    classification: string;
    severity: string;
    count: number;
  }[];
  openExceptionCount: number;
  oldestOpenExceptionHours: number | null;
  correctionTurnaroundHours: number | null;
};

export type ReportingAnalytics = {
  scopeLabel: "Organization" | "Authorized portfolio";
  window: { startsAt: string; endsAt: string; asOf: string; timezone: "UTC" };
  filters: AnalyticsFilters;
  portfolio: AnalyticsRollup;
  branches: readonly AnalyticsRollup[];
  clients: readonly AnalyticsRollup[];
  sites: readonly AnalyticsRollup[];
  displayedSites: number;
  siteCount: number;
  hasMoreSites: boolean;
};

export type AnalyticsPageState =
  | { kind: "ready"; analytics: ReportingAnalytics }
  | { kind: "denied" }
  | { kind: "error"; message: string };
