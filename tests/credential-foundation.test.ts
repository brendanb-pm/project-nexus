import { describe, expect, it } from "vitest";
import {
  credentialCoversAssignment,
  expirationBoundary,
  jurisdictionMatches,
} from "@/features/compliance-admin/canonical";

describe("NX5.1 canonical credential semantics", () => {
  it("keeps a date credential valid through its jurisdictional end of day", () => {
    expect(
      expirationBoundary("2026-09-30", "America/Los_Angeles").toISOString(),
    ).toBe("2026-10-01T07:00:00.000Z");
  });
  it("rejects an overnight assignment that crosses an expiry boundary", () => {
    expect(
      credentialCoversAssignment({
        state: "verified",
        expiresOn: "2026-09-30",
        jurisdiction: {
          kind: "state_province",
          code: "US-CA",
          timezone: "America/Los_Angeles",
        },
        assignmentStart: "2026-10-01T05:00:00.000Z",
        assignmentEnd: "2026-10-01T13:00:00.000Z",
      }),
    ).toBe(false);
  });
  it("handles a DST boundary using the jurisdiction timezone", () => {
    expect(
      expirationBoundary("2026-03-08", "America/Los_Angeles").toISOString(),
    ).toBe("2026-03-09T07:00:00.000Z");
  });
  it("requires verified state and deterministic jurisdiction matching", () => {
    expect(
      credentialCoversAssignment({
        state: "pending_verification",
        jurisdiction: { kind: "organization", timezone: "America/Los_Angeles" },
        assignmentStart: "2026-09-30T10:00:00.000Z",
        assignmentEnd: "2026-09-30T11:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      jurisdictionMatches(
        { kind: "state_province", code: "US-CA" },
        { kind: "state_province", code: "US-OR" },
      ),
    ).toBe(false);
    expect(
      jurisdictionMatches({ kind: "organization" }, { kind: "organization" }),
    ).toBe(true);
  });
});
