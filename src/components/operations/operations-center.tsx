"use client";

import { useMemo, useState } from "react";
import type { OperationsCenterState } from "@/features/operations/application";
import type { OperationalRecordCard } from "@/features/operations/contracts";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
const severity = {
  CRITICAL: "border-red-400/50 bg-red-400/10",
  URGENT: "border-amber-400/50 bg-amber-400/10",
  REVIEW: "border-sky-400/50 bg-sky-400/10",
} as const;

function RecordCard({ record }: { record: OperationalRecordCard }) {
  return (
    <a
      href={record.href}
      className={`block rounded-xl border p-4 transition hover:border-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
        record.actionable
          ? "border-amber-300/35 bg-amber-300/5"
          : "border-white/10 bg-[var(--card)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {record.typeLabel}
          </p>
          <h3 className="mt-1 break-words font-semibold">
            {record.siteName} — {record.postName}
          </h3>
        </div>
        <span
          className={`max-w-full rounded-full border px-2 py-1 text-xs font-medium ${
            record.actionable
              ? "border-amber-300/40 text-amber-100"
              : "border-white/15 text-[var(--text-muted)]"
          }`}
        >
          {record.status}
        </span>
      </div>
      <p className="mt-2 break-words text-sm">{record.summary}</p>
      {record.reviewReason ? (
        <p className="mt-2 text-sm font-medium text-amber-100">
          Why it needs review: {record.reviewReason}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>{record.actorName}</span>
        <span>{new Date(record.timestamp).toLocaleString()}</span>
      </div>
      <p className="mt-3 text-sm font-medium underline">
        Open canonical {record.typeLabel} record
      </p>
    </a>
  );
}

export function OperationsCenter({ state }: { state: OperationsCenterState }) {
  const [filter, setFilter] = useState<
    "ALL" | "CRITICAL" | "URGENT" | "REVIEW"
  >("ALL");
  const [query, setQuery] = useState("");
  const items = useMemo(
    () =>
      (state.kind === "ready" ? state.exceptions.items : []).filter(
        (item) =>
          (filter === "ALL" || item.severity === filter) &&
          `${item.title} ${item.detail}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [state, filter, query],
  );
  if (state.kind !== "ready")
    return (
      <section className={panel} role="alert">
        <h1 className="text-xl font-semibold">Operations Center unavailable</h1>
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
      </section>
    );
  return (
    <div className="grid gap-6">
      <section className={panel}>
        <p className="text-sm text-[var(--text-muted)]">Operations</p>
        <h1 className="text-2xl font-semibold">Operations Center</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          What requires my attention, and what has already happened?
        </p>
      </section>

      <section className="grid gap-3" aria-labelledby="needs-attention-heading">
        <div>
          <h2 id="needs-attention-heading" className="text-xl font-semibold">
            Needs Attention
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Operational exceptions requiring intervention. Record review work
            appears separately below.
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Severity filters"
        >
          {(["ALL", "CRITICAL", "URGENT", "REVIEW"] as const).map((value) => (
            <button
              className="min-h-10 rounded-full border border-white/15 px-3 py-1 text-sm"
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Search exceptions
          <input
            className="mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Site, post, or exception"
          />
        </label>
        <div className="grid gap-3" aria-live="polite">
          {items.length ? (
            items.map((item) => (
              <a
                key={item.id}
                href={item.source.href}
                className={`${panel} border-l-4 ${severity[item.severity]}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {item.severity} · {item.type.replaceAll("_", " ")}
                    </p>
                    <h3 className="mt-1 break-words font-semibold">
                      {item.title}
                    </h3>
                    <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(item.effectiveAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-3 text-sm underline">Open source record</p>
              </a>
            ))
          ) : (
            <div className={panel}>
              <h3 className="font-semibold">No matching exceptions</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                There are no actionable exceptions in your authorized scope.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby="review-queue-heading">
        <div>
          <h2 id="review-queue-heading" className="text-xl font-semibold">
            Review Queue
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Submitted records with a deterministic pending acknowledgement.
          </p>
        </div>
        {state.recordWorkflow.reviewQueue.length ? (
          state.recordWorkflow.reviewQueue.map((record) => (
            <RecordCard key={record.key} record={record} />
          ))
        ) : (
          <div className={panel}>
            <h3 className="font-semibold">Review queue is clear</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              No submitted records require acknowledgement in your authorized
              scope.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="history-heading">
        <div>
          <h2 id="history-heading" className="text-xl font-semibold">
            History / Recent Activity
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Completed informational records. These items do not imply pending
            action.
          </p>
        </div>
        {state.recordWorkflow.history.length ? (
          state.recordWorkflow.history.map((record) => (
            <RecordCard key={record.key} record={record} />
          ))
        ) : (
          <div className={panel}>
            <h3 className="font-semibold">No completed history yet</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Completed records in your authorized scope will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
