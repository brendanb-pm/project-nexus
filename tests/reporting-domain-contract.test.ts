import { describe, expect, it } from "vitest";
import * as reportingActions from "@/app/reporting/actions";
import {
  dailyActivityReportDisposition,
  guardFacingReportTypes,
  legacyReportingRecordTypes,
  operationalRecordTypes,
  shiftReportRecordTypes,
} from "@/features/reporting/contracts";
import { ReportingService } from "@/features/reporting/service";

describe("NX-8.1 reporting authority boundary", () => {
  it("presents one Shift Report and separate Security Incident Report to Guards", () => {
    expect(guardFacingReportTypes).toEqual([
      "ShiftReport",
      "SecurityIncidentReport",
    ]);
    expect(shiftReportRecordTypes).toEqual([
      "ActivityEntry",
      "EndOfShiftReport",
    ]);
    expect(legacyReportingRecordTypes).toEqual(["Handoff"]);
  });

  it("retains the legacy DAR table as evidence without a new authority path", () => {
    expect(dailyActivityReportDisposition).toEqual({
      table: "daily_activity_reports",
      authority: "LEGACY_EVIDENCE_ONLY",
      canonicalReplacement: "ActivityEntry",
      writePolicy: "NO_NEW_WRITERS",
    });
  });

  it("preserves Handoff only for historical review, not new submission", () => {
    expect(operationalRecordTypes).toContain("Handoff");
    expect(ReportingService.prototype).not.toHaveProperty("createHandoff");
    expect(reportingActions).not.toHaveProperty("createHandoff");
  });
});
