import type {
  ReportingExceptionClassification,
  ReportingExceptionState,
  ReportingObligation,
  ReportingObligationType,
} from "./contracts";

const minute = 60_000;

// Every lifecycle change is explicit. Reopening is deliberately limited to an
// Operations/Admin action in the service; it never erases the earlier event.
const transitions: Readonly<
  Record<ReportingExceptionState, readonly ReportingExceptionState[]>
> = {
  OPEN: ["ACKNOWLEDGED", "CORRECTION_REQUESTED", "ESCALATED", "WAIVED"],
  ACKNOWLEDGED: ["CORRECTION_REQUESTED", "ESCALATED", "WAIVED"],
  CORRECTION_REQUESTED: ["CORRECTED_PENDING_REVIEW", "ESCALATED", "WAIVED"],
  CORRECTED_PENDING_REVIEW: [
    "RESOLVED",
    "CORRECTION_REQUESTED",
    "ESCALATED",
    "WAIVED",
  ],
  RESOLVED: ["OPEN"],
  ESCALATED: ["OPEN", "CORRECTION_REQUESTED", "WAIVED"],
  WAIVED: ["OPEN"],
};

export function isReportingExceptionTransitionAllowed(
  previous: ReportingExceptionState,
  next: ReportingExceptionState,
) {
  return transitions[previous].includes(next);
}

export type WorkedAssignmentEvidence = {
  assignmentId: string;
  organizationId: string;
  effectiveShiftEndAt: string;
  clockedIn: boolean;
  positiveApprovedTimeRecord: boolean;
  eosrSubmittedAt?: string;
  activitySubmittedAt?: string;
  reportableActivities: readonly {
    id: string;
    submittedAt: string;
    incidentSubmittedAt?: string;
  }[];
};

export function isWorkedAssignment(value: WorkedAssignmentEvidence) {
  return value.clockedIn || value.positiveApprovedTimeRecord;
}

function classification(
  due: Date,
  effectiveEnd: Date,
  now: Date,
): ReportingExceptionClassification | null {
  if (now <= due) return null;
  return now > new Date(effectiveEnd.valueOf() + 2 * 60 * minute)
    ? "MISSING"
    : "LATE";
}

function key(
  organizationId: string,
  assignmentId: string,
  type: ReportingObligationType,
  trigger?: string,
) {
  return [organizationId, assignmentId, type, trigger ?? "assignment"].join(
    ":",
  );
}

export function deriveReportingObligations(
  source: WorkedAssignmentEvidence,
  now: Date,
): readonly ReportingObligation[] {
  if (!isWorkedAssignment(source)) return [];
  const effectiveEnd = new Date(source.effectiveShiftEndAt);
  const closeDue = new Date(effectiveEnd.valueOf() + 15 * minute);
  const result: ReportingObligation[] = [];
  const add = (
    type: ReportingObligationType,
    due: Date,
    fulfilledAt: string | undefined,
    trigger?: string,
    incidentMissingAtEnd = false,
  ) => {
    const currentClassification = incidentMissingAtEnd
      ? now >= effectiveEnd
        ? "MISSING"
        : now > due
          ? "LATE"
          : null
      : classification(due, effectiveEnd, now);
    if (!currentClassification && !fulfilledAt) return;
    const submitted = fulfilledAt ? new Date(fulfilledAt) : undefined;
    const submittedClassification = submitted
      ? incidentMissingAtEnd
        ? submitted >= effectiveEnd
          ? "MISSING"
          : submitted > due
            ? "LATE"
            : null
        : classification(due, effectiveEnd, submitted)
      : null;
    const wasLate = submittedClassification !== null;
    if (!currentClassification && !wasLate) return;
    result.push({
      key: key(source.organizationId, source.assignmentId, type, trigger),
      type,
      assignmentId: source.assignmentId,
      ...(trigger ? { triggeringActivityEntryId: trigger } : {}),
      dueAt: due.toISOString(),
      effectiveShiftEndAt: effectiveEnd.toISOString(),
      classification: submittedClassification ?? currentClassification!,
      ...(fulfilledAt ? { fulfilledAt } : {}),
    });
  };
  add("EOSR", closeDue, source.eosrSubmittedAt);
  add("ACTIVITY_ENTRY", closeDue, source.activitySubmittedAt);
  for (const activity of source.reportableActivities) {
    const incidentDue = new Date(
      Math.min(
        new Date(activity.submittedAt).valueOf() + 60 * minute,
        effectiveEnd.valueOf(),
        source.eosrSubmittedAt
          ? new Date(source.eosrSubmittedAt).valueOf()
          : Infinity,
      ),
    );
    add(
      "INCIDENT_REPORT",
      incidentDue,
      activity.incidentSubmittedAt,
      activity.id,
      true,
    );
  }
  return result;
}
