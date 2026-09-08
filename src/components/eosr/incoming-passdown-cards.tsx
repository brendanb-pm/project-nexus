"use client";

import type { IncomingPassdown } from "@/features/eosr/contracts";

function shiftLabel(item: IncomingPassdown) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(item.incomingScheduledStart));
}

export function IncomingPassdownCards({
  passdowns,
  setPassdownDismissal,
}: {
  passdowns: readonly IncomingPassdown[];
  setPassdownDismissal: (form: FormData) => Promise<void>;
}) {
  return passdowns.map((item) => (
    <section
      aria-label={`Incoming passdown for ${item.siteName} ${item.postName}`}
      key={`${item.id}:${item.incomingAssignmentId}`}
      className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-4"
    >
      <p className="font-semibold">
        Incoming passdown · {item.siteName} / {item.postName}
      </p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        For your assignment beginning {shiftLabel(item)}
      </p>
      {item.dismissed ? (
        <p className="mt-2 text-sm">
          Passdown dismissed. Reopen it to review the details.
        </p>
      ) : (
        <div className="mt-2 grid gap-2 text-sm">
          <p>{item.summary}</p>
          {item.unresolvedIssues.length ? (
            <p>Unresolved: {item.unresolvedIssues.join(" · ")}</p>
          ) : null}
          {item.equipmentAccessStatus ? (
            <p>Equipment/access: {item.equipmentAccessStatus}</p>
          ) : null}
          {item.followUpItems.length ? (
            <p>Follow-up: {item.followUpItems.join(" · ")}</p>
          ) : null}
          {item.unusualConditions ? (
            <p>Unusual conditions: {item.unusualConditions}</p>
          ) : null}
        </div>
      )}
      <form action={setPassdownDismissal} className="mt-3">
        <input type="hidden" name="id" value={item.id} />
        <input
          type="hidden"
          name="dismissed"
          value={item.dismissed ? "false" : "true"}
        />
        <button className="min-h-11 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium">
          {item.dismissed ? "Reopen passdown" : "Dismiss passdown"}
        </button>
      </form>
    </section>
  ));
}
