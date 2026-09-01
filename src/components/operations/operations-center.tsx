"use client";
import { useMemo, useState } from "react";
import type { OperationsCenterState } from "@/features/operations/application";
const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
const severity = {
  CRITICAL: "border-red-400/50 bg-red-400/10",
  URGENT: "border-amber-400/50 bg-amber-400/10",
  REVIEW: "border-sky-400/50 bg-sky-400/10",
} as const;

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
    <div className="grid gap-5">
      <section className={panel}>
        <p className="text-sm text-[var(--text-muted)]">Operations</p>
        <h1 className="text-2xl font-semibold">Operations Center</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Prioritize the next safe action. Source records remain authoritative.
        </p>
        <div
          className="mt-4 flex flex-wrap gap-2"
          role="group"
          aria-label="Severity filters"
        >
          {(["ALL", "CRITICAL", "URGENT", "REVIEW"] as const).map((value) => (
            <button
              className="rounded-full border border-white/15 px-3 py-1 text-sm"
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm">
          Search exceptions
          <input
            className="mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Site, post, or exception"
          />
        </label>
      </section>
      <section className="grid gap-3" aria-live="polite">
        <h2 className="text-xl font-semibold">Needs Attention</h2>
        {items.length ? (
          items.map((item) => (
            <a
              key={item.id}
              href={item.source.href}
              className={`${panel} border-l-4 ${severity[item.severity]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {item.severity} · {item.type.replaceAll("_", " ")}
                  </p>
                  <h2 className="mt-1 font-semibold">{item.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
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
            <h2 className="font-semibold">No matching exceptions</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              There are no actionable exceptions in your authorized scope.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
