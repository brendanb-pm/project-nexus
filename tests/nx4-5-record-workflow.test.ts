import { describe, expect, it } from "vitest";
import type {
  ActivityEntrySummary,
  HandoffSummary,
  IncidentReportSummary,
} from "@/features/reporting/contracts";
import type { EndOfShiftReport } from "@/features/eosr/contracts";
import {
  isOperationalRecordId,
  isOperationalRecordFamily,
} from "@/features/operations/contracts";
import {
  buildOperationsRecordWorkflow,
  operationalRecordHref,
} from "@/features/operations/record-workflow";

const activity = (
  overrides: Partial<ActivityEntrySummary> = {},
): ActivityEntrySummary => ({
  id: "00000000-0000-4000-8000-000000000091",
  shiftAssignmentId: "assignment-1",
  siteName: "Cedar Plaza North",
  postName: "North Lobby",
  occurredAt: "2026-09-01T10:00:00.000Z",
  category: "OBSERVATION",
  narrative: "Routine patrol completed.",
  followUpRequired: false,
  visibility: "INTERNAL",
  status: "SUBMITTED",
  createdAt: "2026-09-01T10:00:00.000Z",
  incidentGate: "ROUTINE",
  authorName: "Guard A",
  ...overrides,
});

const incident = (
  overrides: Partial<IncidentReportSummary> = {},
): IncidentReportSummary => ({
  id: "00000000-0000-4000-8000-000000000092",
  shiftAssignmentId: "assignment-1",
  incidentNumber: "INC-DEMO-0001",
  siteName: "Cedar Plaza North",
  postName: "North Lobby",
  classification: "SECURITY",
  severity: "LOW",
  occurredAt: "2026-09-01T11:00:00.000Z",
  narrative: "Access concern reported.",
  actionsTaken: "Operations notified.",
  emergencyServiceInvolvement: false,
  status: "SUBMITTED",
  visibility: "INTERNAL",
  createdAt: "2026-09-01T11:00:00.000Z",
  authorName: "Guard A",
  ...overrides,
});

const handoff = (overrides: Partial<HandoffSummary> = {}): HandoffSummary => ({
  id: "00000000-0000-4000-8000-000000000093",
  shiftAssignmentId: "assignment-1",
  siteName: "Cedar Plaza North",
  postName: "North Lobby",
  unresolvedIssues: ["Door closer service pending."],
  equipmentKeyStatus: "Keys accounted for.",
  followUpItems: ["Confirm maintenance."],
  submittedAt: "2026-09-01T12:00:00.000Z",
  status: "SUBMITTED",
  visibility: "INTERNAL",
  createdAt: "2026-09-01T12:00:00.000Z",
  authorName: "Guard A",
  ...overrides,
});

const eosr = (overrides: Partial<EndOfShiftReport> = {}): EndOfShiftReport => ({
  id: "00000000-0000-4000-8000-000000000095",
  shiftAssignmentId: "assignment-1",
  siteName: "Cedar Plaza North",
  postName: "North Lobby",
  summary: "Shift completed.",
  unresolvedIssues: [],
  equipmentAccessStatus: "Keys accounted for.",
  followUpItems: [],
  unusualConditions: "",
  submittedByUserId: "guard-1",
  submittedByName: "Guard A",
  submittedAt: "2026-09-01T13:00:00.000Z",
  ...overrides,
});

describe("NX4.5 Operations record workflow", () => {
  it("separates deterministic review work from informational history", () => {
    const result = buildOperationsRecordWorkflow({
      activities: [activity()],
      incidents: [incident()],
      reports: [eosr()],
      handoffs: [handoff({ acknowledgedAt: "2026-09-01T12:05:00.000Z" })],
    });
    expect(result.reviewQueue.map((record) => record.family)).toEqual([
      "incident",
      "activity",
    ]);
    expect(result.reviewQueue.every((record) => record.reviewReason)).toBe(
      true,
    );
    expect(result.history.map((record) => record.family)).toEqual([
      "eosr",
      "handoff",
    ]);
    expect(result.history.every((record) => !record.actionable)).toBe(true);
  });

  it("suppresses duplicate identity and prefers an actionable representation", () => {
    const duplicate = activity({ acknowledgedAt: "2026-09-01T10:05:00.000Z" });
    const result = buildOperationsRecordWorkflow({
      activities: [duplicate, activity()],
      incidents: [],
      reports: [],
      handoffs: [],
    });
    expect(result.reviewQueue).toHaveLength(1);
    expect(result.history).toHaveLength(0);
    expect(result.reviewQueue[0]?.key).toBe(`activity:${duplicate.id}`);
  });

  it("orders deterministically by meaningful timestamp then stable identity", () => {
    const result = buildOperationsRecordWorkflow({
      activities: [
        activity({ id: "00000000-0000-4000-8000-000000000099" }),
        activity({ id: "00000000-0000-4000-8000-000000000090" }),
      ],
      incidents: [incident()],
      reports: [],
      handoffs: [],
    });
    expect(result.reviewQueue.map((record) => record.key)).toEqual([
      "incident:00000000-0000-4000-8000-000000000092",
      "activity:00000000-0000-4000-8000-000000000090",
      "activity:00000000-0000-4000-8000-000000000099",
    ]);
  });

  it("constructs identity-preserving canonical deep links and rejects invalid paths", () => {
    const id = "00000000-0000-4000-8000-000000000092";
    expect(operationalRecordHref("incident", id)).toBe(
      `/operations/records/incident/${id}`,
    );
    expect(isOperationalRecordFamily("incident")).toBe(true);
    expect(isOperationalRecordFamily("payroll")).toBe(false);
    expect(isOperationalRecordId(id)).toBe(true);
    expect(isOperationalRecordId("stale-record")).toBe(false);
  });
});
