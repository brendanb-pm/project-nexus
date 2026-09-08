import { describe, expect, it } from "vitest";
import { presentationStatus } from "@/components/ui/presentation-status";

describe("presentation status mapping", () => {
  it("keeps domain state while mapping it to the approved presentation buckets", () => {
    expect(presentationStatus("UNCOVERED")).toBe("Action Required");
    expect(presentationStatus("SCHEDULED")).toBe("Pending");
    expect(presentationStatus("CLOCKED_IN")).toBe("In Progress");
    expect(presentationStatus("COMPLETED")).toBe("Resolved");
  });

  it("uses a safe pending presentation for unrecognized future domain states", () => {
    expect(presentationStatus("FUTURE_DOMAIN_STATE")).toBe("Pending");
  });
});
