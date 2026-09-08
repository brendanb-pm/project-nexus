export const operationsExceptionTypes = [
  "INCIDENT_AWAITING_REVIEW",
  "OPERATIONAL_RECORD_AWAITING_REVIEW",
  "CLOCK_EXCEPTION",
  "UNASSIGNED_SHIFT",
  "COVERAGE_GAP",
  "SHIFT_CLOSE_INCOMPLETE",
] as const;

export type OperationsExceptionType = (typeof operationsExceptionTypes)[number];

export type OperationsExceptionSeverity = "CRITICAL" | "URGENT" | "REVIEW";

export type OperationsException = {
  id: string;
  type: OperationsExceptionType;
  severity: OperationsExceptionSeverity;
  effectiveAt: string;
  organizationId: string;
  branchId: string;
  clientId: string;
  siteId: string;
  postId: string;
  shiftId?: string;
  assignmentId?: string;
  source: { entityType: string; entityId: string; href: string };
  title: string;
  detail: string;
};

export type OperationsExceptionPage = {
  items: readonly OperationsException[];
  hasMore: boolean;
};

export const operationalRecordFamilies = [
  "activity",
  "incident",
  "eosr",
  "handoff",
] as const;
export type OperationalRecordFamily =
  (typeof operationalRecordFamilies)[number];

export type OperationalRecordCard = {
  key: string;
  family: OperationalRecordFamily;
  id: string;
  typeLabel: "Activity / DAR" | "Incident" | "EOSR" | "Historical Handoff";
  siteName: string;
  postName: string;
  timestamp: string;
  actorName: string;
  status: "AWAITING ACKNOWLEDGEMENT" | "ACKNOWLEDGED" | "COMPLETED";
  summary: string;
  href: string;
  actionable: boolean;
  reviewReason?: string;
};

export type OperationsRecordWorkflow = {
  reviewQueue: readonly OperationalRecordCard[];
  history: readonly OperationalRecordCard[];
};

export type ScorecardSourceState = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
export type ScorecardMetric = {
  seconds: number | null;
  sourceState: ScorecardSourceState;
  sourceLabel: string;
};
export type CoverageGapSummary = {
  requirementId: string;
  startsAt: string;
  endsAt: string;
  uncoveredSeconds: number;
  state: "CURRENT" | "UPCOMING";
};
export type ShiftCloseSummary = {
  due: number;
  complete: number;
  incomplete: number;
};
export type OperationalPostScorecard = {
  id: string;
  siteId: string;
  name: string;
  status: "CRITICAL" | "ATTENTION" | "UPCOMING" | "HEALTHY" | "NO_REQUIREMENT";
  required: ScorecardMetric;
  scheduled: ScorecardMetric;
  actual: ScorecardMetric;
  coveragePercent: number | null;
  uncovered: ScorecardMetric;
  currentGaps: readonly CoverageGapSummary[];
  upcomingGaps: readonly CoverageGapSummary[];
  activeStaffing: { required: number; assigned: number };
  shiftClose: ShiftCloseSummary;
  incidentCount: number;
  latestIncidentHref?: string;
  schedulingHref: string;
  href: string;
};
export type OperationalSiteScorecard = {
  id: string;
  clientId: string;
  branchId: string;
  name: string;
  timezone: string;
  status: OperationalPostScorecard["status"];
  required: ScorecardMetric;
  scheduled: ScorecardMetric;
  actual: ScorecardMetric;
  coveragePercent: number | null;
  uncovered: ScorecardMetric;
  currentGapCount: number;
  upcomingGapCount: number;
  shiftClose: ShiftCloseSummary;
  incidentCount: number;
  posts: readonly OperationalPostScorecard[];
  href: string;
};
export type OperationalScorecards = {
  window: { startsAt: string; endsAt: string; asOf: string };
  sites: readonly OperationalSiteScorecard[];
};

export function isOperationalRecordFamily(
  value: string,
): value is OperationalRecordFamily {
  return operationalRecordFamilies.includes(value as OperationalRecordFamily);
}

export function isOperationalRecordId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
