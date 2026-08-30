import { ValidationError } from "@/server/request/errors";
import {
  availabilityStatuses,
  shiftStatuses,
  type AvailabilityMutationInput,
  type ShiftMutationInput,
} from "./contracts";
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

export function validateAvailability(input: AvailabilityMutationInput) {
  const timezone = text(input.timezone, "timezone");
  const start = parseZonedInstant(input.startsAt, timezone, "startsAt");
  const end = parseZonedInstant(input.endsAt, timezone, "endsAt");
  if (end <= start)
    throw new ValidationError({ endsAt: ["End must be after start."] });
  if (
    typeof input.status !== "string" ||
    !availabilityStatuses.includes(input.status as never)
  ) {
    throw new ValidationError({ status: ["Select available or unavailable."] });
  }
  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    status: input.status as (typeof availabilityStatuses)[number],
  };
}
