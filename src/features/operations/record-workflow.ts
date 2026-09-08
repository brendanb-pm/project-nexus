import type { EndOfShiftReport } from "@/features/eosr/contracts";
import type {
  ActivityEntrySummary,
  HandoffSummary,
  IncidentReportSummary,
} from "@/features/reporting/contracts";
import type {
  OperationalRecordCard,
  OperationsRecordWorkflow,
} from "./contracts";

export type OperationsRecordSources = {
  activities: readonly ActivityEntrySummary[];
  incidents: readonly IncidentReportSummary[];
  reports: readonly EndOfShiftReport[];
  handoffs: readonly HandoffSummary[];
};

export function operationalRecordHref(
  family: OperationalRecordCard["family"],
  id: string,
) {
  return `/operations/records/${family}/${encodeURIComponent(id)}`;
}

function order(a: OperationalRecordCard, b: OperationalRecordCard) {
  return b.timestamp.localeCompare(a.timestamp) || a.key.localeCompare(b.key);
}

function cards(sources: OperationsRecordSources): OperationalRecordCard[] {
  return [
    ...sources.activities.map((record): OperationalRecordCard => ({
      key: `activity:${record.id}`,
      family: "activity",
      id: record.id,
      typeLabel: "Activity / DAR",
      siteName: record.siteName ?? "Site unavailable",
      postName: record.postName ?? "Post unavailable",
      timestamp: record.occurredAt,
      actorName: record.authorName ?? "Guard",
      status: record.acknowledgedAt
        ? "ACKNOWLEDGED"
        : "AWAITING ACKNOWLEDGEMENT",
      summary: record.narrative,
      href: operationalRecordHref("activity", record.id),
      actionable: !record.acknowledgedAt,
      ...(!record.acknowledgedAt
        ? { reviewReason: "Submitted activity requires acknowledgement." }
        : {}),
    })),
    ...sources.incidents.map((record): OperationalRecordCard => ({
      key: `incident:${record.id}`,
      family: "incident",
      id: record.id,
      typeLabel: "Incident",
      siteName: record.siteName ?? "Site unavailable",
      postName: record.postName ?? "Post unavailable",
      timestamp: record.occurredAt,
      actorName: record.authorName ?? "Guard",
      status: record.acknowledgedAt
        ? "ACKNOWLEDGED"
        : "AWAITING ACKNOWLEDGEMENT",
      summary: `${record.incidentNumber} · ${record.narrative}`,
      href: operationalRecordHref("incident", record.id),
      actionable: !record.acknowledgedAt,
      ...(!record.acknowledgedAt
        ? { reviewReason: "Submitted incident requires acknowledgement." }
        : {}),
    })),
    ...sources.reports.map((record): OperationalRecordCard => ({
      key: `eosr:${record.id}`,
      family: "eosr",
      id: record.id,
      typeLabel: "EOSR",
      siteName: record.siteName,
      postName: record.postName,
      timestamp: record.submittedAt,
      actorName: record.submittedByName ?? "Guard",
      status: record.acknowledgedAt ? "ACKNOWLEDGED" : "COMPLETED",
      summary: record.summary,
      href: operationalRecordHref("eosr", record.id),
      actionable: false,
    })),
    ...sources.handoffs.map((record): OperationalRecordCard => ({
      key: `handoff:${record.id}`,
      family: "handoff",
      id: record.id,
      typeLabel: "Historical Handoff",
      siteName: record.siteName,
      postName: record.postName,
      timestamp: record.submittedAt,
      actorName: record.authorName ?? "Guard",
      status: record.acknowledgedAt
        ? "ACKNOWLEDGED"
        : "AWAITING ACKNOWLEDGEMENT",
      summary:
        record.unresolvedIssues[0] ??
        record.followUpItems[0] ??
        record.equipmentKeyStatus,
      href: operationalRecordHref("handoff", record.id),
      actionable: !record.acknowledgedAt,
      ...(!record.acknowledgedAt
        ? { reviewReason: "Historical handoff requires acknowledgement." }
        : {}),
    })),
  ];
}

export function buildOperationsRecordWorkflow(
  sources: OperationsRecordSources,
): OperationsRecordWorkflow {
  const unique = new Map<string, OperationalRecordCard>();
  for (const card of cards(sources)) {
    const existing = unique.get(card.key);
    if (!existing || (card.actionable && !existing.actionable))
      unique.set(card.key, card);
  }
  const records = [...unique.values()];
  return {
    reviewQueue: records.filter((record) => record.actionable).sort(order),
    history: records.filter((record) => !record.actionable).sort(order),
  };
}
