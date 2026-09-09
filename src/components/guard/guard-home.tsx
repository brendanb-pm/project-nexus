"use client";

import Link from "next/link";
import { IncomingPassdownCards } from "@/components/eosr/incoming-passdown-cards";
import {
  ClockButton,
  mapsUrl,
  type MyScheduleActions,
} from "@/components/schedule/my-schedule";
import type { IncomingPassdown } from "@/features/eosr/contracts";
import type { MySchedulePageState } from "@/features/scheduling/contracts";
import { formatShiftRange } from "@/lib/display-time";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";

export function GuardHome({
  state,
  actions,
  passdowns,
}: {
  state: MySchedulePageState;
  actions: MyScheduleActions;
  passdowns: readonly IncomingPassdown[];
}) {
  if (state.kind !== "ready") {
    return (
      <section className={panel} role="alert">
        <h1 className="text-xl font-semibold">Shift home unavailable</h1>
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
        <Link
          className="mt-4 inline-flex min-h-12 items-center underline"
          href="/schedule"
        >
          View schedule
        </Link>
      </section>
    );
  }
  const assignment =
    state.assignments.find(
      (item) => state.clockStates?.[item.id] === "CLOCK_OUT",
    ) ?? state.assignments[0];
  return (
    <div className="grid gap-6">
      <section className={panel}>
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Shift home
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          Your next operational action
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Use your assignment context, report activity, and return here without
          needing a direct link.
        </p>
      </section>
      {assignment ? (
        <section className={panel} aria-labelledby="current-assignment">
          <p className="text-sm font-semibold text-[var(--text-muted)]">
            Current / next assignment
          </p>
          <h2 className="mt-1 text-xl font-semibold" id="current-assignment">
            {assignment.shift.siteName} — {assignment.shift.postName}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {formatShiftRange(
              assignment.shift.scheduledStart,
              assignment.shift.scheduledEnd,
              assignment.shift.timezone,
            )}
          </p>
          {assignment.shift.siteAddress ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              {assignment.shift.siteAddress}
            </p>
          ) : null}
          {actions.setPassdownDismissal ? (
            <div className="mt-4">
              <IncomingPassdownCards
                passdowns={passdowns}
                setPassdownDismissal={actions.setPassdownDismissal}
              />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {assignment.shift.siteAddress ? (
              <a
                className="inline-flex min-h-12 items-center rounded-lg border border-white/20 px-4 py-2 font-semibold"
                href={mapsUrl(assignment.shift.siteAddress)}
                rel="noreferrer"
                target="_blank"
              >
                Get directions
              </a>
            ) : null}
            <ClockButton
              action={actions.clock}
              assignmentId={assignment.id}
              eventType={state.clockStates?.[assignment.id] ?? "CLOCK_IN"}
            />
          </div>
        </section>
      ) : (
        <section className={panel}>
          <h2 className="text-xl font-semibold">No current assignment</h2>
          <p className="mt-2 text-[var(--text-muted)]">
            There is no assignment ready for clock actions.
          </p>
          <Link
            className="mt-3 inline-flex min-h-12 items-center underline"
            href="/schedule"
          >
            View schedule
          </Link>
        </section>
      )}
      <section
        className="grid gap-3 md:grid-cols-3"
        aria-label="Reporting shortcuts"
      >
        <Link
          className={panel + " min-h-32 hover:border-white/30"}
          href="/reporting#activity"
        >
          <strong>Activity / DAR</strong>
          <span className="mt-2 block text-sm text-[var(--text-muted)]">
            Record routine shift activity.
          </span>
        </Link>
        <Link
          className={panel + " min-h-32 hover:border-white/30"}
          href="/reporting#incident"
        >
          <strong>Incident</strong>
          <span className="mt-2 block text-sm text-[var(--text-muted)]">
            Report an operational incident.
          </span>
        </Link>
        <Link
          className={panel + " min-h-32 hover:border-white/30"}
          href="/eosr"
        >
          <strong>End-of-shift report</strong>
          <span className="mt-2 block text-sm text-[var(--text-muted)]">
            Complete passdown and shift close.
          </span>
        </Link>
      </section>
    </div>
  );
}
