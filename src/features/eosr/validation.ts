import { ValidationError } from "@/server/request/errors";
import type { CreateEndOfShiftReportInput } from "./contracts";

const lines = (value: unknown) =>
  typeof value === "string"
    ? value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 25)
    : [];
export function validateEndOfShiftReport(raw: CreateEndOfShiftReportInput) {
  const shiftAssignmentId =
    typeof raw.shiftAssignmentId === "string" ? raw.shiftAssignmentId : "";
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const submissionKey =
    typeof raw.submissionKey === "string" ? raw.submissionKey.trim() : "";
  const equipmentAccessStatus =
    typeof raw.equipmentAccessStatus === "string"
      ? raw.equipmentAccessStatus.trim().slice(0, 1000)
      : "";
  const unusualConditions =
    typeof raw.unusualConditions === "string"
      ? raw.unusualConditions.trim().slice(0, 2000)
      : "";
  if (!shiftAssignmentId || summary.length < 3 || !submissionKey)
    throw new ValidationError({
      eosr: ["Provide an assignment, shift summary, and retry key."],
    });
  return {
    shiftAssignmentId,
    summary: summary.slice(0, 4000),
    unresolvedIssues: lines(raw.unresolvedIssues),
    equipmentAccessStatus,
    followUpItems: lines(raw.followUpItems),
    unusualConditions,
    submissionKey,
  };
}
