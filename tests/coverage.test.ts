import { describe, expect, it } from "vitest";
import { validateCoverageRequirement } from "@/features/coverage/validation";

describe("weekly coverage requirements", () => {
  it("accepts bounded weekly coverage including overnight windows", () => {
    expect(
      validateCoverageRequirement({
        postId: "post-1",
        requiredCount: 2,
        weekdays: ["MONDAY", "FRIDAY"],
        localStartTime: "22:00",
        localEndTime: "06:00",
        effectiveStart: "2026-09-01",
      }),
    ).toMatchObject({ requiredCount: 2, weekdays: ["FRIDAY", "MONDAY"] });
  });
  it("rejects invalid or complex recurrence inputs", () => {
    expect(() =>
      validateCoverageRequirement({
        postId: "post-1",
        requiredCount: 1,
        weekdays: [],
        localStartTime: "25:00",
        localEndTime: "06:00",
        effectiveStart: "invalid",
      }),
    ).toThrow();
  });
});
