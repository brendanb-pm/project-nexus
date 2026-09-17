import { ValidationError } from "@/server/request/errors";
import {
  activityCategories,
  incidentClassifications,
  incidentSeverities,
  incidentParticipantTypes,
  participantIdentityStates,
  type CreateActivityInput,
  type CreateIncidentInput,
  type IncidentParticipant,
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
  const participants = Array.isArray(input.participants)
    ? input.participants
    : [];
  if (!participants.length)
    errors.participants = ["Add at least one participant."];
  const normalizedParticipants = participants.map((raw, index) => {
    const item =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const type = string(item.type);
    const identityState = string(item.identityState);
    const displayName = string(item.displayName);
    const descriptiveIdentifier = string(item.descriptiveIdentifier);
    const involvementSummary = string(item.involvementSummary);
    const relationshipLabel = string(item.relationshipLabel);
    const agencyName = string(item.agencyName);
    if (
      !incidentParticipantTypes.includes(
        type as (typeof incidentParticipantTypes)[number],
      )
    )
      errors[`participants.${index}.type`] = [
        "Choose an approved participant type.",
      ];
    if (!involvementSummary)
      errors[`participants.${index}.involvementSummary`] = [
        "Describe this participant's involvement.",
      ];
    if (type === "AGENCY") {
      if (!agencyName)
        errors[`participants.${index}.agencyName`] = [
          "Provide the agency name.",
        ];
    } else {
      if (
        !participantIdentityStates.includes(
          identityState as (typeof participantIdentityStates)[number],
        )
      )
        errors[`participants.${index}.identityState`] = [
          "Choose an identity state.",
        ];
      if (identityState === "IDENTIFIED" && !displayName)
        errors[`participants.${index}.displayName`] = [
          "Provide the identified participant's name.",
        ];
      if (identityState !== "IDENTIFIED" && !descriptiveIdentifier)
        errors[`participants.${index}.descriptiveIdentifier`] = [
          "Provide a bounded descriptive identifier.",
        ];
      if (type === "OTHER" && relationshipLabel.length < 2)
        errors[`participants.${index}.relationshipLabel`] = [
          "Provide a specific relationship label.",
        ];
    }
    return {
      type,
      ...(identityState ? { identityState } : {}),
      ...(displayName ? { displayName } : {}),
      ...(descriptiveIdentifier ? { descriptiveIdentifier } : {}),
      involvementSummary,
      ...(relationshipLabel ? { relationshipLabel } : {}),
      ...(agencyName ? { agencyName } : {}),
    };
  });
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
    participants: normalizedParticipants as IncidentParticipant[],
  };
}
