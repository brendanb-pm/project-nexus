import { describe, expect, it } from "vitest";
import {
  reviseRecord,
  transitionRecord,
  type RecordRevision,
} from "@/domain/revisions";

type Report = { narrative: string };
const initial: RecordRevision<Report> = {
  revision: 1,
  status: "DRAFT",
  value: { narrative: "Initial" },
  changedBy: "guard-1",
  changedAt: "2026-08-10T08:00:00.000Z",
};

describe("operational record revisions", () => {
  it("preserves submitted history when a correction is made", () => {
    const submitted = transitionRecord(
      [initial],
      "SUBMITTED",
      "guard-1",
      "2026-08-10T09:00:00.000Z",
    );
    const corrected = reviseRecord(
      submitted,
      { narrative: "Corrected" },
      "supervisor-1",
      "2026-08-10T10:00:00.000Z",
      "Corrected location detail",
    );
    expect(corrected).toHaveLength(3);
    expect(corrected[1]).toMatchObject({
      revision: 2,
      status: "SUBMITTED",
      value: { narrative: "Initial" },
    });
    expect(corrected[2]).toMatchObject({
      revision: 3,
      status: "AMENDED",
      value: { narrative: "Corrected" },
      reason: "Corrected location detail",
    });
  });

  it("requires a reason when correcting a submitted record", () => {
    const submitted = transitionRecord(
      [initial],
      "SUBMITTED",
      "guard-1",
      "2026-08-10T09:00:00.000Z",
    );
    expect(() =>
      reviseRecord(
        submitted,
        { narrative: "Changed" },
        "supervisor-1",
        "2026-08-10T10:00:00.000Z",
      ),
    ).toThrow("requires a reason");
  });
});
