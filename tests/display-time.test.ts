import { describe, expect, it } from "vitest";
import { formatAuditTime, formatShiftRange } from "@/lib/display-time";

describe("operational time presentation", () => {
  it("keeps an overnight range in the source timezone", () => {
    expect(
      formatShiftRange(
        "2026-09-01T06:00:00.000Z",
        "2026-09-01T14:00:00.000Z",
        "America/Los_Angeles",
      ),
    ).toContain("Aug 31");
  });

  it("includes timezone context for audit timestamps", () => {
    expect(
      formatAuditTime("2026-09-01T06:00:00.000Z", "America/Los_Angeles"),
    ).toMatch(/PDT|PST|GMT/);
  });
});
