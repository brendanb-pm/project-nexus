import Link from "next/link";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { GuardShell } from "@/components/guard/guard-shell";
import { loadMySchedulePage } from "@/features/scheduling/application";
import { createSchedulingService } from "@/features/scheduling/server";
import { formatAuditTime, formatWorkedDuration } from "@/lib/display-time";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";

export default async function Page() {
  const resolver = await createProductionPrincipalResolver();
  const state = await loadMySchedulePage(
    createSchedulingService(resolver, "guard-more.page"),
  );
  return (
    <GuardShell>
      <div className="grid gap-6">
        <section className={panel}>
          <h1 className="text-2xl font-semibold">More</h1>
          <p className="mt-2 text-[var(--text-muted)]">
            Timecard and account actions for your guard workflow.
          </p>
        </section>
        <section className={panel}>
          <h2 className="text-xl font-semibold">Timecard</h2>
          {state.kind === "ready" ? (
            <div className="mt-3 grid gap-3">
              {state.assignments.map((assignment) => {
                const events = state.clockEvents?.[assignment.id] ?? [];
                const worked = events.reduce(
                  (total, event, index) =>
                    event.eventType === "CLOCK_OUT" &&
                    events[index - 1]?.eventType === "CLOCK_IN"
                      ? total +
                        Math.max(
                          0,
                          (new Date(event.effectiveAt).valueOf() -
                            new Date(
                              events[index - 1]!.effectiveAt,
                            ).valueOf()) /
                            1000,
                        )
                      : total,
                  0,
                );
                return (
                  <article
                    className="rounded-lg border border-white/10 p-4"
                    key={assignment.id}
                  >
                    <strong>
                      {assignment.shift.siteName} — {assignment.shift.postName}
                    </strong>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {events.length
                        ? `${events.length} clock event${events.length === 1 ? "" : "s"} · ${formatWorkedDuration(worked)}`
                        : "No clock events recorded yet."}
                    </p>
                    {events.map((event) => (
                      <p
                        className="mt-1 text-sm text-[var(--text-muted)]"
                        key={event.id}
                      >
                        {event.eventType === "CLOCK_IN"
                          ? "Clock-in"
                          : "Clock-out"}
                        :{" "}
                        {formatAuditTime(
                          event.effectiveAt,
                          assignment.shift.timezone,
                        )}
                      </p>
                    ))}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
          )}
          <Link
            className="mt-4 inline-flex min-h-12 items-center rounded-lg border border-white/20 px-4 font-semibold"
            href="/schedule"
          >
            Manage schedule and availability
          </Link>
        </section>
        <Link
          className={panel + " min-h-20 hover:border-white/30"}
          href="/credentials"
        >
          <h2 className="text-xl font-semibold">Credential readiness</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Check your verified, expiring, and shift-blocking credentials.
          </p>
        </Link>
        {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
      </div>
    </GuardShell>
  );
}
