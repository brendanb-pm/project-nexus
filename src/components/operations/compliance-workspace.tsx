"use client";

import { useState } from "react";
import type {
  CompliancePriority,
  ComplianceWorkspaceItem,
  ComplianceWorkspacePageState,
} from "@/features/compliance-workspace/contracts";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
const priorityLabel: Record<CompliancePriority, string> = {
  BLOCKING_ASSIGNMENT: "Blocking upcoming assignment",
  EXPIRED_OR_RESTRICTED: "Expired, suspended, or revoked",
  MISSING_REQUIRED: "Missing required credential",
  PENDING_VERIFICATION: "Pending verification",
  EXPIRING_SOON: "Upcoming expirations",
  INFORMATIONAL: "Informational",
};

function Item({ item }: { item: ComplianceWorkspaceItem }) {
  return (
    <article
      className={`${panel} ${item.priority === "BLOCKING_ASSIGNMENT" ? "border-l-4 border-red-400/70" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {priorityLabel[item.priority]}
          </p>
          <h3 className="mt-1 break-words font-semibold">
            {item.employeeName} — {item.credentialName}
          </h3>
          <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
            {item.employeeNumber} · {item.branchName}
            {item.jurisdiction ? ` · ${item.jurisdiction}` : ""}
          </p>
        </div>
        {item.expiresOn ? (
          <span className="rounded-full border border-white/15 px-2 py-1 text-xs">
            Expires {item.expiresOn}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm font-medium">{item.actionStatus}</p>
      {item.assignment ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Affected assignment: {item.assignment.siteName} /{" "}
          {item.assignment.postName} ·{" "}
          {new Date(item.assignment.startsAt).toLocaleString()}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3 text-sm underline">
        <a href={item.href}>Review credential</a>
        {item.assignment ? (
          <a href={item.assignment.href}>View affected assignment</a>
        ) : null}
      </div>
    </article>
  );
}

export function ComplianceWorkspace({
  state,
  employeeId,
}: {
  state: ComplianceWorkspacePageState;
  employeeId?: string;
}) {
  const [priority, setPriority] = useState<CompliancePriority | "ALL">("ALL");
  const [query, setQuery] = useState("");
  if (state.kind !== "ready")
    return (
      <section className={panel} role="alert">
        <h1 className="text-xl font-semibold">
          Compliance workspace unavailable
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
      </section>
    );
  const items = state.workspace.items.filter(
    (item) =>
      (priority === "ALL" || item.priority === priority) &&
      (!employeeId || item.employeeId === employeeId) &&
      `${item.employeeName} ${item.employeeNumber} ${item.credentialName} ${item.assignment?.siteName ?? ""} ${item.assignment?.postName ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="grid gap-6">
      <section className={panel}>
        <p className="text-sm text-[var(--text-muted)]">Operations</p>
        <h1 className="text-2xl font-semibold">Compliance workspace</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Prioritized credential exceptions and their operational impact.
          Credential evidence and identifiers are not shown here.
        </p>
      </section>
      <section className="grid gap-3" aria-label="Compliance summary">
        <h2 className="text-xl font-semibold">Needs Attention</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(priorityLabel) as CompliancePriority[]).map((value) => (
            <button
              aria-pressed={priority === value}
              className={`${panel} min-h-20 text-left hover:border-[var(--accent)]`}
              key={value}
              onClick={() => setPriority(value)}
            >
              <span className="block text-2xl font-semibold">
                {state.workspace.summary[value]}
              </span>
              <span className="text-sm text-[var(--text-muted)]">
                {priorityLabel[value]}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section
        className="grid gap-3"
        aria-labelledby="compliance-queue-heading"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold" id="compliance-queue-heading">
              Compliance queue
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {employeeId
                ? "Focused employee credential context. Clear the filter to return to the full Operations queue."
                : "Blocking assignment impacts are ordered before credential-only risk."}
            </p>
          </div>
          <button
            className="min-h-10 rounded-full border border-white/15 px-3 text-sm"
            onClick={() => setPriority("ALL")}
          >
            Clear filters
          </button>
        </div>
        <label className="text-sm">
          Search employee, credential, Site, or Post
          <input
            className="mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search compliance queue"
            value={query}
          />
        </label>
        <div className="grid gap-3" aria-live="polite">
          {items.length ? (
            items.map((item) => <Item item={item} key={item.id} />)
          ) : (
            <div className={panel}>
              <h3 className="font-semibold">
                No matching compliance exceptions
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                No credential risk matches the current authorized view and
                filters.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
