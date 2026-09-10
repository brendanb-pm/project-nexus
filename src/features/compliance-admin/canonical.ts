export type CredentialJurisdiction = {
  kind: "organization" | "national" | "state_province" | "local";
  code?: string;
  timezone?: string;
};

export type CanonicalCredentialState =
  | "pending_verification"
  | "verified"
  | "expired"
  | "suspended"
  | "revoked"
  | "superseded";

function dateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("A calendar date is required.");
  return match.slice(1).map(Number) as [number, number, number];
}

function zonedParts(instant: Date, timezone: string) {
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
    Number(parts.find((part) => part.type === type)?.value);
  return [
    read("year"),
    read("month"),
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  ];
}

function utcForLocalMidnight(
  year: number,
  month: number,
  day: number,
  timezone: string,
) {
  let timestamp = Date.UTC(year, month - 1, day);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [actualYear, actualMonth, actualDay, hour, minute, second] =
      zonedParts(new Date(timestamp), timezone);
    const requested = Date.UTC(year, month - 1, day);
    const actual = Date.UTC(
      actualYear,
      actualMonth - 1,
      actualDay,
      hour,
      minute,
      second,
    );
    const corrected = timestamp + (requested - actual);
    if (corrected === timestamp) break;
    timestamp = corrected;
  }
  const actual = zonedParts(new Date(timestamp), timezone);
  if (
    actual[0] !== year ||
    actual[1] !== month ||
    actual[2] !== day ||
    actual[3] !== 0 ||
    actual[4] !== 0
  )
    throw new Error(
      "The jurisdiction timezone has no resolvable local midnight.",
    );
  return new Date(timestamp);
}

/** A date-based expiry is inclusive through local end-of-date; the boundary is the following local midnight. */
export function expirationBoundary(
  expirationDate: string,
  timezone: string,
): Date {
  const [year, month, day] = dateParts(expirationDate);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return utcForLocalMidnight(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    timezone,
  );
}

export function credentialCoversAssignment(input: {
  state: CanonicalCredentialState;
  expiresOn?: string;
  jurisdiction: CredentialJurisdiction;
  assignmentStart: string;
  assignmentEnd: string;
}): boolean {
  if (input.state !== "verified") return false;
  const start = new Date(input.assignmentStart);
  const end = new Date(input.assignmentEnd);
  if (
    Number.isNaN(start.valueOf()) ||
    Number.isNaN(end.valueOf()) ||
    end <= start
  )
    return false;
  if (!input.expiresOn) return true;
  if (!input.jurisdiction.timezone) return false;
  return (
    expirationBoundary(input.expiresOn, input.jurisdiction.timezone) >= end
  );
}

export function jurisdictionMatches(
  definition: CredentialJurisdiction,
  requirement: CredentialJurisdiction,
): boolean {
  if (definition.kind !== requirement.kind) return false;
  return (
    definition.kind === "organization" || definition.code === requirement.code
  );
}
