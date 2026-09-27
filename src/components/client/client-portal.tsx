import Link from "next/link";
import type { loadClientPortal } from "@/features/client-portal/server";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";

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
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className={panel}>
        <p className="text-sm text-[var(--text-muted)]">Client portal</p>
        <h1 className="text-2xl font-semibold">Published site reports</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Only confirmed report versions for your authorized client and sites
          appear here.
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Showing up to 25 recent published versions.
        </p>
      </header>
      {state.publications.length ? (
        <section className="grid gap-3" aria-label="Published reports">
          {state.publications.map((report) => (
            <article className={panel} key={report.id}>
              <h2 className="text-lg font-semibold">
                {report.snapshot.clientName} · Version {report.version}
              </h2>
              <p className="mt-1 text-sm">
                {report.isCurrent
                  ? "Current published version"
                  : "Superseded historical version"}
              </p>
              <p className="mt-2 text-sm">
                {report.snapshot.sites.map((site) => site.name).join(", ")}
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Published {new Date(report.publishedAt).toLocaleString()}
              </p>
              <p className="mt-3">{report.snapshot.executiveSummary}</p>
              <Link
                className="mt-3 inline-block underline"
                href={`/portal/reports/${report.id}`}
              >
                Open published version
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <section className={panel}>
          No published client reports are available for your authorized sites.
        </section>
      )}
    </div>
  );
}
