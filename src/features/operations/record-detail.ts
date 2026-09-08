import type { EndOfShiftReportService } from "@/features/eosr/service";
import type { ReviewRecord } from "@/features/reporting/contracts";
import type { ReportingService } from "@/features/reporting/service";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type {
  OperationalRecordCard,
  OperationalRecordFamily,
} from "./contracts";
import { buildOperationsRecordWorkflow } from "./record-workflow";

export type OperationalRecordDetailState =
  | {
      kind: "ready";
      record: OperationalRecordCard;
      fields: readonly { label: string; value: string }[];
      review?: ReviewRecord;
    }
  | { kind: "unavailable" }
  | { kind: "error" };

function cardFor(
  sources: Parameters<typeof buildOperationsRecordWorkflow>[0],
  key: string,
) {
  const workflow = buildOperationsRecordWorkflow(sources);
  return [...workflow.reviewQueue, ...workflow.history].find(
    (item) => item.key === key,
  );
}

export async function loadOperationalRecordDetail(
  family: OperationalRecordFamily,
  id: string,
  reportingServiceOrPromise: ReportingService | Promise<ReportingService>,
  eosrServiceOrPromise:
    EndOfShiftReportService | Promise<EndOfShiftReportService>,
): Promise<OperationalRecordDetailState> {
  try {
    const [reporting, eosr] = await Promise.all([
      reportingServiceOrPromise,
      eosrServiceOrPromise,
    ]);
    if (family === "activity") {
      const item = (await reporting.listAuthorizedActivities(100)).find(
        (record) => record.id === id,
      );
      if (!item) throw new ResourceNotFoundError("Operational record");
      const review = await reporting.getReviewRecord("ActivityEntry", id);
      return {
        kind: "ready",
        record: cardFor(
          { activities: [item], incidents: [], reports: [], handoffs: [] },
          `activity:${id}`,
        )!,
        fields: [
          { label: "Category", value: item.category.replaceAll("_", " ") },
          { label: "Narrative", value: item.narrative },
          ...(item.locationContext
            ? [{ label: "Location / context", value: item.locationContext }]
            : []),
          ...(item.actionTaken
            ? [{ label: "Action taken", value: item.actionTaken }]
            : []),
          {
            label: "Follow-up required",
            value: item.followUpRequired ? "Yes" : "No",
          },
        ],
        review,
      };
    }
    if (family === "incident") {
      const item = (await reporting.listAuthorizedIncidents(100)).find(
        (record) => record.id === id,
      );
      if (!item) throw new ResourceNotFoundError("Operational record");
      const review = await reporting.getReviewRecord("IncidentReport", id);
      return {
        kind: "ready",
        record: cardFor(
          { activities: [], incidents: [item], reports: [], handoffs: [] },
          `incident:${id}`,
        )!,
        fields: [
          { label: "Incident number", value: item.incidentNumber },
          { label: "Classification", value: item.classification },
          { label: "Severity", value: item.severity },
          { label: "Narrative", value: item.narrative },
          { label: "Actions taken", value: item.actionsTaken },
          {
            label: "Emergency services",
            value: item.emergencyServiceInvolvement
              ? "Involved"
              : "Not involved",
          },
        ],
        review,
      };
    }
    if (family === "handoff") {
      const item = (await reporting.listAuthorizedHandoffs(100)).find(
        (record) => record.id === id,
      );
      if (!item) throw new ResourceNotFoundError("Operational record");
      const review = await reporting.getReviewRecord("Handoff", id);
      return {
        kind: "ready",
        record: cardFor(
          { activities: [], incidents: [], reports: [], handoffs: [item] },
          `handoff:${id}`,
        )!,
        fields: [
          {
            label: "Unresolved issues",
            value: item.unresolvedIssues.join(" · ") || "None recorded",
          },
          {
            label: "Equipment / keys",
            value: item.equipmentKeyStatus || "No detail recorded",
          },
          {
            label: "Follow-up items",
            value: item.followUpItems.join(" · ") || "None recorded",
          },
        ],
        review,
      };
    }
    const item = (await eosr.listCompletedReports(100)).find(
      (record) => record.id === id,
    );
    if (!item) throw new ResourceNotFoundError("Operational record");
    return {
      kind: "ready",
      record: cardFor(
        { activities: [], incidents: [], reports: [item], handoffs: [] },
        `eosr:${id}`,
      )!,
      fields: [
        { label: "Shift summary", value: item.summary },
        {
          label: "Unresolved issues",
          value: item.unresolvedIssues.join(" · ") || "None recorded",
        },
        {
          label: "Equipment / access",
          value: item.equipmentAccessStatus || "No detail recorded",
        },
        {
          label: "Follow-up items",
          value: item.followUpItems.join(" · ") || "None recorded",
        },
        ...(item.unusualConditions
          ? [{ label: "Unusual conditions", value: item.unusualConditions }]
          : []),
      ],
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError ||
      error instanceof ResourceNotFoundError
    )
      return { kind: "unavailable" };
    return { kind: "error" };
  }
}
