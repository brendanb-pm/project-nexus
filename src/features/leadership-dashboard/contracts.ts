import type { ComplianceWorkspaceSources } from "@/features/compliance-workspace/contracts";
import type { ScorecardSources } from "@/features/operations/scorecards";
import type { ScorecardMetric } from "@/features/operations/contracts";

export type LeadershipDashboardScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
  clientIds: readonly string[];
  siteIds: readonly string[];
};

export type LeadershipDashboardFilters = {
  clientId?: string;
  siteId?: string;
};

export type LeadershipHierarchyClient = { id: string; name: string };
export type LeadershipHierarchySite = {
  id: string;
  clientId: string;
  name: string;
};

export type LeadershipIncidentRow = {
  id: string;
  siteId: string;
  postId?: string;
  occurredAt: string;
  status: "DRAFT" | "SUBMITTED" | "ACKNOWLEDGED" | "APPROVED" | "AMENDED";
};

export type LeadershipDashboardSources = {
  hierarchy: {
    clients: readonly LeadershipHierarchyClient[];
    sites: readonly LeadershipHierarchySite[];
  };
  scorecards: Omit<ScorecardSources, "incidents"> & {
    incidents: readonly LeadershipIncidentRow[];
  };
  compliance: ComplianceWorkspaceSources;
};

export type LeadershipDashboard = {
  scopeLabel: "Organization" | "Authorized portfolio";
  window: { startsAt: string; endsAt: string; asOf: string };
  filters: {
    clients: readonly LeadershipHierarchyClient[];
    sites: readonly LeadershipHierarchySite[];
    selectedClientId?: string;
    selectedSiteId?: string;
  };
  operationalHealth: {
    required: ScorecardMetric;
    scheduled: ScorecardMetric;
    actual: ScorecardMetric;
    coveragePercent: number | null;
    currentGapCount: number;
    upcomingGapCount: number;
    scheduledStaffing: { assigned: number; required: number };
    shiftClose: { due: number; complete: number; incomplete: number };
  };
  incidents: { submittedOrLater: number };
  compliance: {
    blockingAssignment: number;
    expiredOrRestricted: number;
    missingRequired: number;
    pendingVerification: number;
    expiringSoon: number;
  };
  exceptions: readonly {
    siteId: string;
    siteName: string;
    postId: string;
    postName: string;
    status: "CRITICAL" | "ATTENTION" | "UPCOMING";
    currentGapCount: number;
    upcomingGapCount: number;
    incompleteShiftCloseCount: number;
    href: string;
  }[];
  financial: { state: "UNAVAILABLE"; message: string };
};

export type LeadershipDashboardPageState =
  | { kind: "ready"; dashboard: LeadershipDashboard }
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean };
