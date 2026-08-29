import { ValidationError } from "@/server/request/errors";
import { shiftStatuses, type ShiftMutationInput } from "./contracts";
import { parseZonedInstant } from "./time";
import type { ShiftMutation } from "./repository";

const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError({ [field]: ["This field is required."] });
  }
  return value.trim();
};

export function validateShift(input: ShiftMutationInput): ShiftMutation {
  const postId = text(input.postId, "postId");
  const timezone = text(input.timezone, "timezone");
  const start = parseZonedInstant(
    input.scheduledStart,
    timezone,
    "scheduledStart",
  );
  const end = parseZonedInstant(input.scheduledEnd, timezone, "scheduledEnd");
  if (end <= start) {
    throw new ValidationError({ scheduledEnd: ["End must be after start."] });
  }
  const staffingRequirement = Number(input.staffingRequirement);
  if (
    !Number.isInteger(staffingRequirement) ||
    staffingRequirement < 1 ||
    staffingRequirement > 100
  ) {
    throw new ValidationError({
      staffingRequirement: ["Staffing must be between 1 and 100."],
    });
  }
  if (
    typeof input.status !== "string" ||
    !shiftStatuses.includes(input.status as never)
  ) {
    throw new ValidationError({ status: ["Select a valid shift status."] });
  }
  return {
    postId,
    timezone,
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
    staffingRequirement,
    status: input.status as ShiftMutation["status"],
  };
}
