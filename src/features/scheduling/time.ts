import { ValidationError } from "@/server/request/errors";

const explicitInstant = /(?:Z|[+-]\d{2}:\d{2})$/;

function localParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match?.slice(1).map(Number);
}

function zonedParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return [
    read("year"),
    read("month"),
    read("day"),
    read("hour"),
    read("minute"),
  ];
}

export function parseZonedInstant(
  value: unknown,
  timezone: unknown,
  field: string,
): Date {
  if (typeof value !== "string" || !explicitInstant.test(value)) {
    throw new ValidationError({
      [field]: ["Include an explicit UTC offset to disambiguate local time."],
    });
  }
  if (typeof timezone !== "string" || !timezone.trim()) {
    throw new ValidationError({ timezone: ["Select an IANA timezone."] });
  }
  let instant: Date;
  try {
    instant = new Date(value);
    if (Number.isNaN(instant.valueOf())) throw new Error("invalid");
    const intended = localParts(value);
    if (
      !intended ||
      !zonedParts(instant, timezone).every((part, i) => part === intended[i])
    ) {
      throw new ValidationError({
        [field]: [
          "The local time and offset do not exist in the selected timezone.",
        ],
      });
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError({ [field]: ["Enter a valid date and time."] });
  }
  return instant;
}

export function intervalsOverlap(
  firstStart: string | Date,
  firstEnd: string | Date,
  secondStart: string | Date,
  secondEnd: string | Date,
): boolean {
  return (
    new Date(firstStart).valueOf() < new Date(secondEnd).valueOf() &&
    new Date(secondStart).valueOf() < new Date(firstEnd).valueOf()
  );
}
