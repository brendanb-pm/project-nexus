export const operationsExceptionTypes = [
  "INCIDENT_AWAITING_REVIEW",
  "OPERATIONAL_RECORD_AWAITING_REVIEW",
  "CLOCK_EXCEPTION",
  "UNASSIGNED_SHIFT",
  "COVERAGE_GAP",
] as const;

export type OperationsExceptionType =
  (typeof operationsExceptionTypes)[number];

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
