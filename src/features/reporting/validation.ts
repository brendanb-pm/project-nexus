import { ValidationError } from "@/server/request/errors";
import { activityCategories, type CreateActivityInput } from "./contracts";
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
