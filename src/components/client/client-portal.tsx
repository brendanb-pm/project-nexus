import type { loadClientPortal } from "@/features/client-portal/server";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
function coverageStatus(status: string) {
  if (status === "CRITICAL") return "Coverage needs attention";
  if (status === "ATTENTION") return "Coverage needs review";
  if (status === "UPCOMING") return "Upcoming coverage change";
  if (status === "NO_REQUIREMENT") return "Coverage requirement not configured";
  return "Coverage on track";
}

export function ClientPortal({
  state,
}: {
  state: Awaited<ReturnType<typeof loadClientPortal>> | { error: string };
}) {
  if ("error" in state)
    return (
      <section className={panel} role="alert">
        <h1 className="text-2xl font-semibold">Client portal unavailable</h1>
        <p className="mt-2">{state.error}</p>
      </section>
    );
  return (
    <div className="grid gap-6">
      <section className={panel}>
        <p className="text-sm text-[var(--text-muted)]">Client portal</p>
        <h1 className="text-2xl font-semibold">Your operational visibility</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Authorized site reports and incidents. This portal is read-only.
        </p>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Current coverage</h2>
        {state.coverage.length ? (
          state.coverage.map((site) => (
            <article className={panel} key={site.id}>
              <strong>{site.name}</strong>
              <p className="mt-2 text-sm">{coverageStatus(site.status)}</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {site.coveragePercent === null
                  ? "Coverage percentage is not available."
                  : `${site.coveragePercent}% scheduled coverage.`}
                {site.currentGapCount
                  ? ` ${site.currentGapCount} current gap${site.currentGapCount === 1 ? "" : "s"}.`
                  : " No current coverage gap."}
                {site.upcomingGapCount
                  ? ` ${site.upcomingGapCount} upcoming gap${site.upcomingGapCount === 1 ? "" : "s"}.`
                  : ""}
              </p>
              <ul className="mt-3 grid gap-2 text-sm text-[var(--text-muted)]">
                {site.posts.map((post) => (
                  <li key={post.id}>
                    {post.name}: {coverageStatus(post.status)}
                    {post.coveragePercent === null
                      ? ""
                      : ` · ${post.coveragePercent}% scheduled coverage`}
                  </li>
                ))}
              </ul>
            </article>
          ))
        ) : (
          <div className={panel}>No authorized sites are available.</div>
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Recent reports</h2>
        {state.reports.length ? (
          state.reports.map((r) => (
            <article className={panel} key={r.id}>
              <strong>
                {r.site} — {r.post}
              </strong>
              <p className="mt-2 text-sm">{r.narrative}</p>
              {r.actionTaken ? (
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Action taken: {r.actionTaken}
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <div className={panel}>No client-visible reports are available.</div>
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Recent incidents</h2>
        {state.incidents.length ? (
          state.incidents.map((i) => (
            <article className={panel} key={i.id}>
              <strong>
                {i.number} · {i.site} — {i.post}
              </strong>
              <p className="mt-2 text-sm">{i.narrative}</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Actions: {i.actionsTaken}
              </p>
            </article>
          ))
        ) : (
          <div className={panel}>
            No client-visible incidents are available.
          </div>
        )}
      </section>
    </div>
  );
}
