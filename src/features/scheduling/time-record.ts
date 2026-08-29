import { InvariantViolationError } from "@/server/request/errors";
import type {
  ClockCorrectionSummary,
  ClockEventSummary,
  TimePair,
} from "./contracts";

export function deriveTimePairs(
  events: readonly ClockEventSummary[],
  corrections: readonly ClockCorrectionSummary[],
): { pairs: readonly TimePair[]; secondsWorked: number } {
  const latest = new Map<string, ClockCorrectionSummary>();
  for (const correction of corrections) {
    const current = latest.get(correction.clockEventId);
    if (!current || correction.revision > current.revision) {
      latest.set(correction.clockEventId, correction);
    }
  }
  const ordered = [...events].sort(
    (left, right) =>
      new Date(left.occurredAt).valueOf() -
      new Date(right.occurredAt).valueOf(),
  );
  const pairs: TimePair[] = [];
  let clockIn: ClockEventSummary | undefined;
  for (const event of ordered) {
    if (
      event.verificationStatus === "EXCEPTION_REQUIRED" &&
      !latest.has(event.id)
    ) {
      throw new InvariantViolationError(
        "Clock exceptions must be resolved before time approval.",
      );
    }
    if (event.eventType === "CLOCK_IN") {
      if (clockIn) {
        throw new InvariantViolationError(
          "Clock history contains two clock-ins without a clock-out.",
        );
      }
      clockIn = event;
      continue;
    }
    if (!clockIn) {
      throw new InvariantViolationError(
        "Clock history contains a clock-out without a clock-in.",
      );
    }
    const startsAt =
      latest.get(clockIn.id)?.correctedEffectiveAt ?? clockIn.effectiveAt;
    const endsAt =
      latest.get(event.id)?.correctedEffectiveAt ?? event.effectiveAt;
    const milliseconds =
      new Date(endsAt).valueOf() - new Date(startsAt).valueOf();
    if (milliseconds <= 0 || milliseconds % 1000 !== 0) {
      throw new InvariantViolationError(
        "Effective clock times must form a positive exact-second interval.",
      );
    }
    pairs.push({
      clockInEventId: clockIn.id,
      clockOutEventId: event.id,
      startsAt,
      endsAt,
      secondsWorked: milliseconds / 1000,
    });
    clockIn = undefined;
  }
  if (clockIn) {
    throw new InvariantViolationError(
      "An incomplete clock pair must be resolved before time approval.",
    );
  }
  if (!pairs.length) {
    throw new InvariantViolationError(
      "At least one complete clock pair is required.",
    );
  }
  return {
    pairs,
    secondsWorked: pairs.reduce((total, pair) => total + pair.secondsWorked, 0),
  };
}
