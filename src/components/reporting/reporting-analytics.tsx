import Link from "next/link";
import {
  incidentClassifications,
  incidentSeverities,
} from "@/features/reporting/contracts";
import type {
  AnalyticsPageState,
  AnalyticsRollup,
  ReportingAnalytics,
} from "@/features/reporting-analytics/contracts";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";

function pageHref(value: ReportingAnalytics, page: number) {
  const params = new URLSearchParams();
  params.set("window", String(value.filters.windowHours));
  for (const key of [
    "branchId",
    "clientId",
    "siteId",
    "incidentClassification",
    "incidentSeverity",
    "incidentStatus",
  ] as const)
    if (value.filters[key]) params.set(key, value.filters[key]);
  if (page) params.set("sitePage", String(page));
  return `/reports/analytics?${params.toString()}`;
}

function fraction(value: AnalyticsRollup["shiftReportCompletion"]) {
  return value.percent === null
    ? "Not applicable — no eligible worked assignments"
    : `${value.percent}% (${value.numerator}/${value.denominator})`;
}

function Summary({ value }: { value: AnalyticsRollup }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className={panel}>
        <h2 className="font-semibold">Shift Report completion</h2>
        <p>{fraction(value.shiftReportCompletion)}</p>
        <p className="text-sm text-[var(--text-muted)]">
          Submitted EOSR and required Activity Entry
        </p>
      </div>
      <div className={panel}>
        <h2 className="font-semibold">On-time EOSR closeout</h2>
        <p>{fraction(value.onTimeCloseout)}</p>
      </div>
      <div className={panel}>
        <h2 className="font-semibold">Activity obligation coverage</h2>
        <p>{fraction(value.activityCoverage)}</p>
      </div>
      <div className={panel}>
        <h2 className="font-semibold">Submitted incidents</h2>
        <p>{value.incidentCount}</p>
        <p className="text-sm text-[var(--text-muted)]">Drafts excluded</p>
      </div>
      <div className={panel}>
        <h2 className="font-semibold">Open exceptions due in period</h2>
        <p>{value.openExceptionCount}</p>
        <p className="text-sm text-[var(--text-muted)]">
          Oldest:{" "}
          {value.oldestOpenExceptionHours === null
            ? "None"
            : `${Math.round(value.oldestOpenExceptionHours)} hours`}
        </p>
      </div>
      <div className={panel}>
        <h2 className="font-semibold">Correction turnaround</h2>
        <p>
          {value.correctionTurnaroundHours === null
            ? "Insufficient data"
            : `${value.correctionTurnaroundHours} hours average`}
        </p>
      </div>
    </div>
  );
}

export function ReportingAnalyticsView({
  state,
}: {
  state: AnalyticsPageState;
}) {
  if (state.kind === "denied")
    return (
      <main className={panel} role="alert">
        <h1>Reporting analytics unavailable</h1>
        <p>Your account cannot view this operational analysis.</p>
      </main>
    );
  if (state.kind === "error")
    return (
      <main className={panel} role="alert">
        <h1>Reporting analytics unavailable</h1>
        <p>{state.message}</p>
        <Link href="/reports/analytics">Try again</Link>
      </main>
    );
  const { analytics } = state;
  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:px-8">
      <header className={panel}>
        <Link href="/reports" className="underline">
          Reporting Hub
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Reporting analytics</h1>
        <p>
          {analytics.scopeLabel} · {analytics.window.startsAt} to{" "}
          {analytics.window.endsAt} · UTC rolling window
        </p>
        <p className="text-sm text-[var(--text-muted)]">
          Read-only canonical reporting evidence. Refreshed at{" "}
          {analytics.window.asOf}. Comparisons show at most 50 sites; headline
          metrics use the full authorized population.
        </p>
      </header>
      <form
        className={`${panel} grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}
        method="get"
        aria-label="Reporting analytics filters"
      >
        <label>
          Period
          <select
            name="window"
            defaultValue={String(analytics.filters.windowHours)}
            className="mt-1 block min-h-11 w-full rounded border bg-[var(--background)]"
          >
            <option value="24">Previous 24 hours</option>
            <option value="168">Previous 7 days</option>
            <option value="720">Previous 30 days</option>
          </select>
        </label>
        {(
          [
            ["branchId", "Branch", analytics.branches],
            ["clientId", "Client", analytics.clients],
            ["siteId", "Site", analytics.sites],
          ] as const
        ).map(([key, label, options]) => (
          <label key={key}>
            {label}
            <select
              name={key}
              defaultValue={analytics.filters[key] ?? ""}
              className="mt-1 block min-h-11 w-full rounded border bg-[var(--background)]"
            >
              <option value="">All authorized {label.toLowerCase()}s</option>
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Incident classification
          <select
            name="incidentClassification"
            defaultValue={analytics.filters.incidentClassification ?? ""}
            className="mt-1 block min-h-11 w-full rounded border bg-[var(--background)]"
          >
            <option value="">All classifications</option>
            {incidentClassifications.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Incident severity
          <select
            name="incidentSeverity"
            defaultValue={analytics.filters.incidentSeverity ?? ""}
            className="mt-1 block min-h-11 w-full rounded border bg-[var(--background)]"
          >
            <option value="">All severities</option>
            {incidentSeverities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Incident status
          <select
            name="incidentStatus"
            defaultValue={analytics.filters.incidentStatus ?? ""}
            className="mt-1 block min-h-11 w-full rounded border bg-[var(--background)]"
          >
            <option value="">All submitted-or-later</option>
            {["SUBMITTED", "ACKNOWLEDGED", "APPROVED", "AMENDED"].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>
        <p className="self-center text-sm text-[var(--text-muted)]">
          Incident filters affect incident counts only.
        </p>
        <button className="min-h-11 rounded bg-[var(--accent-control)] px-4 font-semibold text-white lg:col-span-4 lg:w-fit">
          Apply filters
        </button>
      </form>
      <section aria-label="Operational reporting metrics">
        <Summary value={analytics.portfolio} />
      </section>
      <section className={panel} aria-labelledby="incidents-heading">
        <h2 id="incidents-heading" className="text-lg font-semibold">
          Incident classification and severity
        </h2>
        {analytics.portfolio.incidentDistribution.length ? (
          <ul>
            {analytics.portfolio.incidentDistribution.map((item) => (
              <li key={`${item.classification}:${item.severity}`}>
                {item.classification} · {item.severity}: {item.count}
              </li>
            ))}
          </ul>
        ) : (
          <p>No submitted incidents in this period.</p>
        )}
      </section>
      <section className={panel} aria-labelledby="comparison-heading">
        <h2 id="comparison-heading" className="text-lg font-semibold">
          Site comparison
        </h2>
        {analytics.sites.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Completion</th>
                  <th scope="col">Incidents</th>
                  <th scope="col">Open exceptions</th>
                  <th scope="col">Drill-down</th>
                </tr>
              </thead>
              <tbody>
                {analytics.sites.map((site) => (
                  <tr key={site.key} className="border-t border-white/10">
                    <th scope="row" className="py-3">
                      {site.label}
                    </th>
                    <td>{fraction(site.shiftReportCompletion)}</td>
                    <td>{site.incidentCount}</td>
                    <td>{site.openExceptionCount}</td>
                    <td>
                      <Link
                        className="underline"
                        href={`/reports?siteId=${site.key}`}
                      >
                        View records
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {analytics.siteCount
              ? "No sites on this comparison page."
              : "No reporting evidence in this authorized period."}
          </p>
        )}
        {analytics.siteCount > 50 ? (
          <p>
            Showing {analytics.displayedSites} of {analytics.siteCount} sites by
            name. Portfolio totals include all authorized sites.
          </p>
        ) : null}
        <nav className="mt-3 flex gap-4" aria-label="Site comparison pages">
          {(analytics.filters.sitePage ?? 0) > 0 ? (
            <Link
              className="min-h-11 underline"
              href={pageHref(analytics, (analytics.filters.sitePage ?? 0) - 1)}
            >
              Previous sites
            </Link>
          ) : null}
          {analytics.hasMoreSites ? (
            <Link
              className="min-h-11 underline"
              href={pageHref(analytics, (analytics.filters.sitePage ?? 0) + 1)}
            >
              Next sites
            </Link>
          ) : null}
        </nav>
      </section>
      <section className={panel} aria-label="Client and branch comparison">
        <h2 className="text-lg font-semibold">Portfolio comparison</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">Branches</h3>
            <ul>
              {analytics.branches.map((row) => (
                <li key={row.key}>
                  {row.label}: {fraction(row.shiftReportCompletion)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">Clients</h3>
            <ul>
              {analytics.clients.map((row) => (
                <li key={row.key}>
                  {row.label}: {fraction(row.shiftReportCompletion)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
