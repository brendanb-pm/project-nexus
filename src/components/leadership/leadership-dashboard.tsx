import type {
  LeadershipDashboard,
  LeadershipDashboardPageState,
} from "@/features/leadership-dashboard/contracts";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";

function hours(seconds: number | null) {
  return seconds === null ? "Unavailable" : `${(seconds / 3600).toFixed(1)}h`;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 p-3">
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
      <dd className="mt-1 text-xs text-[var(--text-muted)]">{detail}</dd>
    </div>
  );
}

function OperationalHealth({ dashboard }: { dashboard: LeadershipDashboard }) {
  const { operationalHealth } = dashboard;
  return (
    <section
      className="grid gap-3"
      aria-labelledby="operational-health-heading"
    >
      <div>
        <h2 className="text-xl font-semibold" id="operational-health-heading">
          Operational Health
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Coverage is derived from required coverage, assigned schedules, and
          authoritative worked-time records.
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Coverage"
          value={
            operationalHealth.coveragePercent === null
              ? "Not applicable"
              : `${operationalHealth.coveragePercent}%`
          }
          detail={operationalHealth.required.sourceLabel}
        />
        <Metric
          label="Required"
          value={hours(operationalHealth.required.seconds)}
          detail={
            operationalHealth.required.sourceState === "AVAILABLE"
              ? "Coverage requirement"
              : operationalHealth.required.sourceState
          }
        />
        <Metric
          label="Scheduled"
          value={hours(operationalHealth.scheduled.seconds)}
          detail="Assigned schedule, not attendance"
        />
        <Metric
          label="Actual worked"
          value={hours(operationalHealth.actual.seconds)}
          detail={
            operationalHealth.actual.sourceState === "PARTIAL"
              ? "Partial authoritative time"
              : operationalHealth.actual.sourceState === "UNAVAILABLE"
                ? "No authoritative time"
                : "Authoritative time"
          }
        />
        <Metric
          label="Scheduled staffing now"
          value={`${operationalHealth.scheduledStaffing.assigned} / ${operationalHealth.scheduledStaffing.required}`}
          detail="Assigned / required; not attendance"
        />
      </dl>
    </section>
  );
}

export function LeadershipDashboardView({
  state,
}: {
  state: LeadershipDashboardPageState;
}) {
  if (state.kind !== "ready")
    return (
      <section className={panel} role="alert">
        <h1 className="text-xl font-semibold">
          {state.kind === "permission-denied"
            ? "Leadership dashboard unavailable"
            : "Leadership dashboard temporarily unavailable"}
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
      </section>
    );

  const { dashboard } = state;
  return (
    <div className="grid gap-6">
      <section className={panel}>
        <p className="text-sm text-[var(--text-muted)]">
          {dashboard.scopeLabel}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Leadership Operations</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Operational health for the rolling 12 hours before and after the
          current time.
        </p>
      </section>

      <form className={`${panel} grid gap-3 sm:grid-cols-3`} method="get">
        <label className="text-sm">
          Client
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3"
            defaultValue={dashboard.filters.selectedClientId ?? ""}
            name="clientId"
          >
            <option value="">All authorized clients</option>
            {dashboard.filters.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Site
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3"
            defaultValue={dashboard.filters.selectedSiteId ?? ""}
            name="siteId"
          >
            <option value="">All authorized sites</option>
            {dashboard.filters.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button
            className="min-h-11 rounded-lg border border-white/20 px-4 font-semibold"
            type="submit"
          >
            Apply scope
          </button>
          <a className="min-h-11 py-3 text-sm underline" href="/leadership">
            Clear
          </a>
        </div>
      </form>

      <OperationalHealth dashboard={dashboard} />

      <section
        className="grid gap-3"
        aria-labelledby="coverage-exceptions-heading"
      >
        <div>
          <h2
            className="text-xl font-semibold"
            id="coverage-exceptions-heading"
          >
            Staffing &amp; Coverage Exceptions
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Current gaps, upcoming gaps, and incomplete shift close are ordered
            using canonical scorecard status.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Current gaps"
            value={String(dashboard.operationalHealth.currentGapCount)}
            detail="Required coverage uncovered now"
          />
          <Metric
            label="Upcoming gaps"
            value={String(dashboard.operationalHealth.upcomingGapCount)}
            detail="Scheduled future coverage risk"
          />
          <Metric
            label="Incomplete shift close"
            value={String(dashboard.operationalHealth.shiftClose.incomplete)}
            detail={`${dashboard.operationalHealth.shiftClose.complete} complete / ${dashboard.operationalHealth.shiftClose.due} due`}
          />
        </div>
        {dashboard.exceptions.length ? (
          <div className="grid gap-3">
            {dashboard.exceptions.map((item) => (
              <a
                className={`${panel} ${item.status === "CRITICAL" ? "border-l-4 border-red-400/70" : ""}`}
                href={item.href}
                key={item.postId}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {item.status.replace("_", " ")}
                </p>
                <h3 className="mt-1 font-semibold">
                  {item.siteName} — {item.postName}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {item.currentGapCount} current gap
                  {item.currentGapCount === 1 ? "" : "s"} ·{" "}
                  {item.upcomingGapCount} upcoming gap
                  {item.upcomingGapCount === 1 ? "" : "s"} ·{" "}
                  {item.incompleteShiftCloseCount} incomplete close
                  {item.incompleteShiftCloseCount === 1 ? "" : "s"}
                </p>
                <p className="mt-3 text-sm underline">
                  Inspect canonical Post scorecard
                </p>
              </a>
            ))}
          </div>
        ) : (
          <div className={panel}>
            <h3 className="font-semibold">No operational exceptions</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              No critical, attention, or upcoming Post status is represented in
              this authorized view.
            </p>
          </div>
        )}
      </section>

      <section
        className="grid gap-3"
        aria-labelledby="reporting-health-heading"
      >
        <div>
          <h2 className="text-xl font-semibold" id="reporting-health-heading">
            Incident / Reporting Health
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Draft incidents are excluded. Shift-close status is shown above; no
            DAR-compliance rate is inferred.
          </p>
        </div>
        <Metric
          label="Submitted-or-later incidents"
          value={String(dashboard.incidents.submittedOrLater)}
          detail="Distinct incident reports in this operational window"
        />
      </section>

      <section className="grid gap-3" aria-labelledby="compliance-risk-heading">
        <div>
          <h2 className="text-xl font-semibold" id="compliance-risk-heading">
            Compliance Risk
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Aggregate risk only. Employee and credential details are not shown
            in the leadership dashboard.
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Blocking assignment"
            value={String(dashboard.compliance.blockingAssignment)}
            detail="Canonical qualification conflict"
          />
          <Metric
            label="Expired / restricted"
            value={String(dashboard.compliance.expiredOrRestricted)}
            detail="Expired, suspended, or revoked"
          />
          <Metric
            label="Missing required"
            value={String(dashboard.compliance.missingRequired)}
            detail="Required credential absent"
          />
          <Metric
            label="Pending"
            value={String(dashboard.compliance.pendingVerification)}
            detail="Awaiting verification"
          />
          <Metric
            label="Expiring soon"
            value={String(dashboard.compliance.expiringSoon)}
            detail="Configured warning window"
          />
        </dl>
      </section>

      <section className={panel} aria-labelledby="financial-heading">
        <h2 className="text-xl font-semibold" id="financial-heading">
          Financial Performance
        </h2>
        <p className="mt-2 text-[var(--text-muted)]">
          {dashboard.financial.message}
        </p>
      </section>
    </div>
  );
}
