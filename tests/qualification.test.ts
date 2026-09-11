import { describe, expect, it } from "vitest";
import { evaluateQualification } from "@/features/scheduling/qualification";

const requirement = {
  definitionId: "state-license",
  key: "credential:armed_security",
  displayName: "State license",
  severity: "required" as const,
  jurisdiction: {
    kind: "state_province" as const,
    code: "US-CA",
    timezone: "America/Los_Angeles",
  },
};
const interval = {
  scheduledStart: "2026-10-01T05:00:00.000Z",
  scheduledEnd: "2026-10-01T13:00:00.000Z",
};
describe("NX5.2 canonical qualification", () => {
  it("requires verified coverage for the complete shift", () => {
    expect(
      evaluateQualification({
        requirements: [requirement],
        credentials: [
          {
            definitionId: requirement.definitionId,
            key: requirement.key,
            state: "verified",
            expiresOn: "2026-09-30",
            jurisdiction: requirement.jurisdiction,
          },
        ],
        ...interval,
      })[0]?.reason,
    ).toBe("EXPIRES_DURING_SHIFT");
  });
  it("returns distinct non-leaking state and jurisdiction reasons", () => {
    expect(
      evaluateQualification({
        requirements: [requirement],
        credentials: [],
        ...interval,
      })[0]?.reason,
    ).toBe("MISSING");
    expect(
      evaluateQualification({
        requirements: [requirement],
        credentials: [
          {
            definitionId: requirement.definitionId,
            key: requirement.key,
            state: "pending_verification",
            jurisdiction: requirement.jurisdiction,
          },
        ],
        ...interval,
      })[0]?.reason,
    ).toBe("PENDING_VERIFICATION");
    expect(
      evaluateQualification({
        requirements: [requirement],
        credentials: [
          {
            definitionId: requirement.definitionId,
            key: requirement.key,
            state: "verified",
            jurisdiction: { ...requirement.jurisdiction, code: "US-WA" },
          },
        ],
        ...interval,
      })[0]?.reason,
    ).toBe("JURISDICTION_MISMATCH");
  });
  it("does not block an informational requirement", () => {
    expect(
      evaluateQualification({
        requirements: [{ ...requirement, severity: "informational" }],
        credentials: [],
        ...interval,
      })[0],
    ).toMatchObject({ blocking: false, reason: "MISSING" });
  });
});
