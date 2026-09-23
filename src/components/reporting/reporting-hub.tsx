import Link from "next/link";
import type {
  InternalReportHub,
  ReportHubPageState,
} from "@/features/reporting-hub/contracts";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";

function destination(
  title: string,
  description: string,
  href: string,
  action: string,
) {
  return (
    <Link className={`${panel} block hover:border-white/30`} href={href}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>
      <span className="mt-4 inline-flex min-h-11 items-center font-medium underline">
        {action}
      </span>
    </Link>
  );
}

function queryFor(state: InternalReportHub, cursor?: string) {
  const params = new URLSearchParams();
  if (state.filters.siteId) params.set("siteId", state.filters.siteId);
  if (state.filters.family) params.set("family", state.filters.family);
  if (state.filters.status) params.set("status", state.filters.status);
  params.set("window", String(state.filters.windowHours));
  if (cursor) params.set("cursor", cursor);
  return `/reports?${params.toString()}`;
}

function InternalBrowse({ state }: { state: InternalReportHub }) {
  return (
    <>
      <section className={panel} aria-labelledby="report-filters-heading">
        <h2 className="text-xl font-semibold" id="report-filters-heading">
          Operational reporting browse
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Showing your {state.scopeLabel.toLowerCase()}. Results are bounded to
          50 records per page and never reconcile or change reporting data.
        </p>
        {state.sitesLimited ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Site choices show the first 200 authorized sites. Open the
            Operations Center for the complete hierarchy.
          </p>
        ) : null}
        <form className="mt-4 grid gap-4 md:grid-cols-4" method="get">
          <label className="text-sm">
            Site
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3"
              defaultValue={state.filters.siteId ?? ""}
              name="siteId"
            >
              <option value="">All authorized sites</option>
              {state.sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Record family
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3"
              defaultValue={state.filters.family ?? ""}
              name="family"
            >
              <option value="">All record families</option>
              <option value="activity">Activity Entry</option>
              <option value="incident">Security Incident Report</option>
              <option value="eosr">EOSR / Shift Closeout</option>
              <option value="exception">Reporting Exception</option>
            </select>
          </label>
          <label className="text-sm">
            Lifecycle / status
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3"
              defaultValue={state.filters.status ?? ""}
              name="status"
            >
              <option value="">All applicable statuses</option>
              {[
                "DRAFT",
                "SUBMITTED",
                "ACKNOWLEDGED",
                "APPROVED",
                "AMENDED",
                "OPEN",
                "CORRECTION_REQUESTED",
                "CORRECTED_PENDING_REVIEW",
                "RESOLVED",
                "ESCALATED",
                "WAIVED",
              ].map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Time range
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3"
              defaultValue={String(state.filters.windowHours)}
              name="window"
            >
              <option value="24">Previous 24 hours</option>
              <option value="168">Previous 7 days</option>
              <option value="720">Previous 30 days</option>
            </select>
          </label>
          <button className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold md:col-span-4 md:w-fit">
            Apply filters
          </button>
        </form>
      </section>

      <section className="grid gap-3" aria-labelledby="report-results-heading">
        <h2 className="text-xl font-semibold" id="report-results-heading">
          Reporting records
        </h2>
        {state.rows.length ? (
          state.rows.map((row) => (
            <Link
              className={`${panel} block hover:border-white/30`}
              href={row.href}
              key={`${row.family}:${row.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {row.familyLabel}
                  </p>
                  <h3 className="mt-1 font-semibold">
                    {row.siteName} — {row.postName}
                  </h3>
                </div>
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs">
                  {row.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm">{row.summary}</p>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                {new Date(row.timestamp).toLocaleString()}
              </p>
              <p className="mt-3 text-sm font-medium underline">
                Open canonical workflow
              </p>
            </Link>
          ))
        ) : (
          <div className={panel}>
            <h3 className="font-semibold">No matching reporting records</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Try another authorized site, record family, status, or time range.
            </p>
          </div>
        )}
        {state.hasMore && state.nextCursor ? (
          <Link
            className="inline-flex min-h-11 w-fit items-center rounded-lg border border-white/20 px-4 py-2 font-semibold"
            href={queryFor(state, state.nextCursor)}
          >
            View next 50 records
          </Link>
        ) : null}
      </section>

      <section
        className="grid gap-3 md:grid-cols-2"
        aria-label="Canonical reporting workflows"
      >
        {destination(
          "Operations Center",
          "Review operational records and use established exception workflows.",
          "/operations",
          "Open Operations Center",
        )}
        {destination(
          "Reporting exceptions",
          "Manage late and missing obligations in the canonical lifecycle queue.",
          "/operations/reporting-exceptions",
          "Open exception queue",
        )}
      </section>
    </>
  );
}

export function ReportingHub({ state }: { state: ReportHubPageState }) {
  if (state.kind === "denied")
    return (
      <section className={panel} role="alert">
        <h1 className="text-xl font-semibold">Reporting Hub unavailable</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Your account does not have access to a reporting product.
        </p>
      </section>
    );
  if (state.kind === "error")
    return (
      <section className={panel} role="alert">
        <h1 className="text-xl font-semibold">Reporting Hub unavailable</h1>
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center underline"
          href="/reports"
        >
          Try again
        </Link>
      </section>
    );

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:px-8">
      <section className={panel}>
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Reporting Hub
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          Authorized reporting work
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Open the canonical product for your role. This Hub is a read-only
          navigation and operational browse layer, not another report authority.
        </p>
      </section>
      {state.kind === "internal" ? <InternalBrowse state={state} /> : null}
      {state.kind === "guard"
        ? destination(
            "Your Shift Report",
            "Record Activity Entries, create a separate Security Incident Report, and complete EOSR closeout and passdown.",
            "/reporting",
            "Open Shift Report",
          )
        : null}
      {state.kind === "client"
        ? destination(
            "Client reporting",
            "View only reports and incidents explicitly approved for your authorized client and sites.",
            "/portal",
            "Open client portal",
          )
        : null}
      {state.kind === "leadership"
        ? destination(
            "Leadership operations",
            "Use the existing aggregate-safe operational dashboard. No employee-level compliance details are exposed here.",
            "/leadership",
            "Open leadership dashboard",
          )
        : null}
    </main>
  );
}
