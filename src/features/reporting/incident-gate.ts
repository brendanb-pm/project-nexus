import type { ActivityCategory, IncidentGateOutcome } from "./contracts";

const outcomes: Record<ActivityCategory, IncidentGateOutcome> = {
  OBSERVATION: "ROUTINE",
  ACCESS_CONTROL: "SUGGESTED",
  SAFETY_CHECK: "ROUTINE",
  SAFETY_CONCERN: "SUGGESTED",
  REPORTABLE_INCIDENT: "REQUIRED",
  CUSTOMER_SERVICE: "ROUTINE",
  OTHER: "ROUTINE",
};

export function incidentGateFor(
  category: ActivityCategory,
): IncidentGateOutcome {
  return outcomes[category];
}

export function incidentGateMessage(outcome: IncidentGateOutcome) {
  if (outcome === "REQUIRED")
    return "An Incident Report is required for this activity.";
  if (outcome === "SUGGESTED")
    return "Consider creating an Incident Report if this activity involved a security event.";
  return "This activity is recorded as routine.";
}
