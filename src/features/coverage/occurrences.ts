import type { CoverageRequirement, CoverageWeekday } from "./contracts";

export type CoverageOccurrence = {
  requirementId: string;
  postId: string;
  startsAt: string;
  endsAt: string;
  requiredCount: number;
};

const weekdays: CoverageWeekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

function localParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function localInstant(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const probes = [naive - 86400000, naive, naive + 86400000];
  const candidates = new Set<number>();
  for (const probe of probes) {
    const parts = localParts(new Date(probe), timezone);
    const offset =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ) - probe;
    const candidate = naive - offset;
    const check = localParts(new Date(candidate), timezone);
    if (
      check.year === year &&
      check.month === month &&
      check.day === day &&
      check.hour === hour &&
      check.minute === minute &&
      check.second === second
    )
      candidates.add(candidate);
  }
  const first = [...candidates].sort((a, b) => a - b)[0];
  return first === undefined ? null : new Date(first);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function materializeCoverageOccurrences(
  requirements: readonly CoverageRequirement[],
  startsAt: string,
  endsAt: string,
): CoverageOccurrence[] {
  const windowStart = new Date(startsAt);
  const windowEnd = new Date(endsAt);
  const results: CoverageOccurrence[] = [];
  for (const requirement of requirements) {
    if (!requirement.active) continue;
    const localWindowStart = localParts(
      new Date(windowStart.valueOf() - 86400000),
      requirement.timezone,
    );
    const cursor = new Date(
      Date.UTC(
        localWindowStart.year,
        localWindowStart.month - 1,
        localWindowStart.day,
      ),
    );
    for (let offset = 0; offset < 35; offset += 1) {
      const localDate = dateKey(new Date(cursor.valueOf() + offset * 86400000));
      if (requirement.effectiveEnd && localDate > requirement.effectiveEnd)
        continue;
      if (localDate < requirement.effectiveStart) continue;
      const day = weekdays[new Date(`${localDate}T12:00:00Z`).getUTCDay()]!;
      if (!requirement.weekdays.includes(day)) continue;
      const start = localInstant(
        localDate,
        requirement.localStartTime,
        requirement.timezone,
      );
      let endDate = localDate;
      if (requirement.localEndTime <= requirement.localStartTime) {
        endDate = dateKey(
          new Date(new Date(`${localDate}T00:00:00Z`).valueOf() + 86400000),
        );
      }
      const end = localInstant(
        endDate,
        requirement.localEndTime,
        requirement.timezone,
      );
      if (!start || !end || start >= windowEnd || end <= windowStart) continue;
      results.push({
        requirementId: requirement.id,
        postId: requirement.postId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        requiredCount: requirement.requiredCount,
      });
      if (start > windowEnd) break;
    }
  }
  return results.sort(
    (a, b) =>
      a.startsAt.localeCompare(b.startsAt) ||
      a.requirementId.localeCompare(b.requirementId),
  );
}

export function capacitySeconds(
  startsAt: string,
  endsAt: string,
  requiredCount: number,
  intervals: readonly { startsAt: string; endsAt: string }[],
) {
  const start = new Date(startsAt).valueOf();
  const end = new Date(endsAt).valueOf();
  const events: { at: number; delta: number }[] = [];
  for (const interval of intervals) {
    const from = Math.max(start, new Date(interval.startsAt).valueOf());
    const to = Math.min(end, new Date(interval.endsAt).valueOf());
    if (from < to) events.push({ at: from, delta: 1 }, { at: to, delta: -1 });
  }
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let cursor = start;
  let count = 0;
  let covered = 0;
  for (const event of events) {
    covered += Math.max(0, event.at - cursor) * Math.min(count, requiredCount);
    count += event.delta;
    cursor = event.at;
  }
  covered += Math.max(0, end - cursor) * Math.min(count, requiredCount);
  return Math.round(covered / 1000);
}

export function uncoveredSegments(
  startsAt: string,
  endsAt: string,
  requiredCount: number,
  intervals: readonly { startsAt: string; endsAt: string }[],
) {
  const start = new Date(startsAt).valueOf();
  const end = new Date(endsAt).valueOf();
  const changes = new Map<number, number>([
    [start, 0],
    [end, 0],
  ]);
  for (const interval of intervals) {
    const from = Math.max(start, new Date(interval.startsAt).valueOf());
    const to = Math.min(end, new Date(interval.endsAt).valueOf());
    if (from < to) {
      changes.set(from, (changes.get(from) ?? 0) + 1);
      changes.set(to, (changes.get(to) ?? 0) - 1);
    }
  }
  const boundaries = [...changes].sort(([a], [b]) => a - b);
  const result: {
    startsAt: string;
    endsAt: string;
    uncoveredSeconds: number;
  }[] = [];
  let count = 0;
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const [at, delta] = boundaries[index]!;
    count += delta;
    const next = boundaries[index + 1]![0];
    if (at < next && count < requiredCount) {
      result.push({
        startsAt: new Date(at).toISOString(),
        endsAt: new Date(next).toISOString(),
        uncoveredSeconds: Math.round(
          ((next - at) / 1000) * (requiredCount - count),
        ),
      });
    }
  }
  return result;
}
