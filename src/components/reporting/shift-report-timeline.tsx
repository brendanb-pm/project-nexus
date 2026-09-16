"use client";

import type {
  ActivityEntrySummary,
  IncidentReportSummary,
} from "@/features/reporting/contracts";
import { incidentGateMessage } from "@/features/reporting/incident-gate";

function categoryLabel(category: string) {
  return category
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function activityTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ShiftReportTimeline({
  entries,
  incidents,
  hasMore,
  onFileIncident,
}: {
  entries: readonly ActivityEntrySummary[];
  incidents: readonly IncidentReportSummary[];
  hasMore: boolean;
  onFileIncident(activityEntryId: string): void;
}) {
  const linkedIncidents = new Map(
    incidents
      .filter((incident) => incident.originatingActivityEntryId)
      .map((incident) => [incident.originatingActivityEntryId!, incident]),
  );

  return (
    <section
      aria-labelledby="timeline-heading"
      className="rounded-2xl border border-white/10 bg-[var(--card)] p-4 md:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold" id="timeline-heading">
            Today’s timeline
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Chronological activity for this authorized assignment
          </p>
        </div>
        <span className="rounded-full border border-white/15 px-3 py-1 text-sm font-semibold">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {entries.length ? (
        <ol className="relative mt-6 grid gap-4 before:absolute before:bottom-4 before:left-[22px] before:top-4 before:w-px before:bg-white/10">
          {entries.map((entry) => {
            const incident = linkedIncidents.get(entry.id);
            return (
              <li
                className="relative grid grid-cols-[46px_minmax(0,1fr)] gap-3"
                key={entry.id}
              >
                <time
                  className="z-10 mt-4 rounded-lg border border-white/15 bg-[var(--background)] px-1 py-1 text-center text-xs font-bold"
                  dateTime={entry.occurredAt}
                >
                  {activityTime(entry.occurredAt)}
                </time>
                <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-semibold">
                      {categoryLabel(entry.category)}
                    </span>
                    {incident ? (
                      <a
                        className="rounded-full border border-red-400/40 bg-red-400/10 px-2.5 py-1 text-xs font-bold text-red-100 hover:bg-red-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200"
                        href={`#incident-${incident.id}`}
                      >
                        Linked · {incident.incidentNumber}
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-3 break-words leading-6">
                    {entry.narrative}
                  </p>
                  {entry.locationContext ? (
                    <p className="mt-3 text-sm text-[var(--text-muted)]">
                      <strong className="text-[var(--text-primary)]">
                        Location:
                      </strong>{" "}
                      {entry.locationContext}
                    </p>
                  ) : null}
                  {entry.actionTaken ? (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      <strong className="text-[var(--text-primary)]">
                        Action:
                      </strong>{" "}
                      {entry.actionTaken}
                    </p>
                  ) : null}
                  {entry.followUpRequired ? (
                    <p className="mt-3 text-sm font-semibold text-amber-100">
                      Follow-up required
                    </p>
                  ) : null}
                  {incident ? (
                    <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/[0.07] p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-red-100">
                        Security Incident Report · {incident.classification} ·{" "}
                        {incident.severity}
                      </p>
                      <p className="mt-1 line-clamp-2 break-words text-sm text-[#d7d3ce]">
                        {incident.narrative}
                      </p>
                      <a
                        className="mt-3 inline-flex min-h-12 items-center rounded-xl border border-red-400/35 px-3 text-sm font-bold text-red-50"
                        href={`#incident-${incident.id}`}
                      >
                        View {incident.incidentNumber}
                      </a>
                    </div>
                  ) : entry.incidentGate !== "ROUTINE" ? (
                    <div className="mt-4 rounded-xl border border-amber-400/35 bg-amber-400/[0.08] p-3">
                      <p className="text-sm text-amber-100">
                        {incidentGateMessage(entry.incidentGate)}
                      </p>
                      <button
                        className="mt-3 min-h-12 rounded-xl border border-amber-300/35 px-3 text-sm font-bold text-amber-50"
                        onClick={() => onFileIncident(entry.id)}
                        type="button"
                      >
                        File Security Incident
                      </button>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <h3 className="font-bold">No activity recorded yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
            Add timestamped activity as the shift progresses. Entries will
            appear here in chronological order.
          </p>
        </div>
      )}
      {hasMore ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Showing the 50 most recent entries for this shift.
        </p>
      ) : null}
    </section>
  );
}
