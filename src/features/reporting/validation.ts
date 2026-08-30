import { ValidationError } from "@/server/request/errors";
import {
  activityCategories,
  incidentClassifications,
  incidentSeverities,
  type CreateActivityInput,
  type CreateIncidentInput,
  type CreateHandoffInput,
  operationalRecordTypes,
  type AcknowledgeOperationalRecordInput,
  type AmendOperationalRecordInput,
} from "./contracts";
import { visibilityClassifications } from "@/domain/model";

const string = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export function validateActivity(input: CreateActivityInput) {
  const category = string(input.category);
  const narrative = string(input.narrative);
  const submissionKey = string(input.submissionKey);
  const visibility = string(input.visibility) || "INTERNAL";
  const errors: Record<string, string[]> = {};
  if (
    !activityCategories.includes(
      category as (typeof activityCategories)[number],
    )
  )
    errors.category = ["Choose an activity category."];
  if (!narrative) errors.narrative = ["Describe what happened."];
  if (narrative.length > 4000)
    errors.narrative = ["Keep the narrative under 4,000 characters."];
  if (!submissionKey || submissionKey.length > 100)
    errors.submissionKey = ["Start a new submission and try again."];
  if (
    !visibilityClassifications.includes(
      visibility as (typeof visibilityClassifications)[number],
    )
  )
    errors.visibility = ["Choose a valid visibility level."];
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return {
    shiftAssignmentId: string(input.shiftAssignmentId),
    category: category as (typeof activityCategories)[number],
    narrative,
    submissionKey,
    visibility: visibility as (typeof visibilityClassifications)[number],
    locationContext: string(input.locationContext) || undefined,
    actionTaken: string(input.actionTaken) || undefined,
    followUpRequired:
      input.followUpRequired === true ||
      input.followUpRequired === "true" ||
      input.followUpRequired === "on",
  };
}

export function validateAcknowledgement(
  input: AcknowledgeOperationalRecordInput,
) {
  const entityType = string(input.entityType);
  const recordId = string(input.recordId);
  if (
    !operationalRecordTypes.includes(
      entityType as (typeof operationalRecordTypes)[number],
    ) ||
    !recordId
  )
    throw new ValidationError({
      record: ["Choose a valid operational record."],
    });
  return {
    entityType: entityType as (typeof operationalRecordTypes)[number],
    recordId,
  };
}

export function validateAmendment(input: AmendOperationalRecordInput) {
  const target = validateAcknowledgement(input);
  const reason = string(input.reason);
  const idempotencyKey = string(input.idempotencyKey);
  const expectedRevision = Number(input.expectedRevision);
  const amendment =
    input.amendment &&
    typeof input.amendment === "object" &&
    !Array.isArray(input.amendment)
      ? (input.amendment as Record<string, unknown>)
      : null;
  const errors: Record<string, string[]> = {};
  if (reason.length < 3 || reason.length > 2000)
    errors.reason = [
      "Provide a meaningful amendment reason (3–2,000 characters).",
    ];
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
    errors.expectedRevision = ["Refresh the record and try again."];
  if (!idempotencyKey || idempotencyKey.length > 100)
    errors.idempotencyKey = ["Start a new amendment and try again."];
  if (!amendment || !Object.keys(amendment).length)
    errors.amendment = ["Provide the corrected record details."];
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return {
    ...target,
    reason,
    expectedRevision,
    idempotencyKey,
    amendment: amendment!,
  };
}

export function validateIncident(input: CreateIncidentInput) {
  const classification = string(input.classification);
  const severity = string(input.severity);
  const narrative = string(input.narrative);
  const actionsTaken = string(input.actionsTaken);
  const submissionKey = string(input.submissionKey);
  const visibility = string(input.visibility) || "INTERNAL";
  const errors: Record<string, string[]> = {};
  if (
    !incidentClassifications.includes(
      classification as (typeof incidentClassifications)[number],
    )
  )
    errors.classification = ["Choose an incident classification."];
  if (
    !incidentSeverities.includes(
      severity as (typeof incidentSeverities)[number],
    )
  )
    errors.severity = ["Choose an incident severity."];
  if (!narrative) errors.narrative = ["Describe the incident."];
  if (narrative.length > 8000)
    errors.narrative = ["Keep the narrative under 8,000 characters."];
  if (!actionsTaken)
    errors.actionsTaken = ["Describe the immediate actions taken."];
  if (actionsTaken.length > 4000)
    errors.actionsTaken = ["Keep actions taken under 4,000 characters."];
  if (!submissionKey || submissionKey.length > 100)
    errors.submissionKey = ["Start a new submission and try again."];
  if (
    !visibilityClassifications.includes(
      visibility as (typeof visibilityClassifications)[number],
    )
  )
    errors.visibility = ["Choose a valid visibility level."];
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return {
    shiftAssignmentId: string(input.shiftAssignmentId),
    originatingActivityEntryId:
      string(input.originatingActivityEntryId) || undefined,
    classification: classification as (typeof incidentClassifications)[number],
    severity: severity as (typeof incidentSeverities)[number],
    narrative,
    actionsTaken,
    submissionKey,
    visibility: visibility as (typeof visibilityClassifications)[number],
    emergencyServiceInvolvement:
      input.emergencyServiceInvolvement === true ||
      input.emergencyServiceInvolvement === "true" ||
      input.emergencyServiceInvolvement === "on",
    externalReportNumber: string(input.externalReportNumber) || undefined,
  };
}

function list(value: unknown, field: string, errors: Record<string, string[]>) {
  const entries = string(value)
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.some((entry) => entry.length > 500))
    errors[field] = ["Keep each item under 500 characters."];
  if (entries.length > 25) errors[field] = ["Provide no more than 25 items."];
  return entries;
}

export function validateHandoff(input: CreateHandoffInput) {
  const submissionKey = string(input.submissionKey);
  const visibility = string(input.visibility) || "INTERNAL";
  const equipmentKeyStatus = string(input.equipmentKeyStatus);
  const errors: Record<string, string[]> = {};
  const unresolvedIssues = list(
    input.unresolvedIssues,
    "unresolvedIssues",
    errors,
  );
  const followUpItems = list(input.followUpItems, "followUpItems", errors);
  if (equipmentKeyStatus.length > 2000)
    errors.equipmentKeyStatus = [
      "Keep equipment and key status under 2,000 characters.",
    ];
  if (!submissionKey || submissionKey.length > 100)
    errors.submissionKey = ["Start a new submission and try again."];
  if (
    !visibilityClassifications.includes(
      visibility as (typeof visibilityClassifications)[number],
    )
  )
    errors.visibility = ["Choose a valid visibility level."];
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return {
    shiftAssignmentId: string(input.shiftAssignmentId),
    unresolvedIssues,
    equipmentKeyStatus,
    followUpItems,
    submissionKey,
    visibility: visibility as (typeof visibilityClassifications)[number],
  };
}
