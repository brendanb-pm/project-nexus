import { ValidationError } from "@/server/request/errors";
import { coverageWeekdays, type CoverageRequirementInput, type CoverageWeekday } from "./contracts";

const time = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const date = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export function validateCoverageRequirement(raw: CoverageRequirementInput) {
  const postId = typeof raw.postId === "string" ? raw.postId.trim() : "";
  const requiredCount = typeof raw.requiredCount === "number" ? raw.requiredCount : NaN;
  const weekdays = Array.isArray(raw.weekdays) ? [...new Set(raw.weekdays.filter((value): value is CoverageWeekday => typeof value === "string" && coverageWeekdays.includes(value as CoverageWeekday)))].sort() : [];
  const localStartTime = typeof raw.localStartTime === "string" ? raw.localStartTime : "";
  const localEndTime = typeof raw.localEndTime === "string" ? raw.localEndTime : "";
  const effectiveStart = typeof raw.effectiveStart === "string" ? raw.effectiveStart : "";
  const effectiveEnd = typeof raw.effectiveEnd === "string" && raw.effectiveEnd ? raw.effectiveEnd : undefined;
  if (!postId || !Number.isInteger(requiredCount) || requiredCount < 1 || requiredCount > 100 || !weekdays.length || !time.test(localStartTime) || !time.test(localEndTime) || !date.test(effectiveStart) || (effectiveEnd && (!date.test(effectiveEnd) || effectiveEnd < effectiveStart))) throw new ValidationError({ coverage: ["Coverage requirement has invalid weekly recurrence fields."] });
  return { postId, requiredCount, weekdays, localStartTime, localEndTime, effectiveStart, ...(effectiveEnd ? { effectiveEnd } : {}) };
}
