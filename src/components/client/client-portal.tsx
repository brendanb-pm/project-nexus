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
    <div className="grid gap-6">
      <section className={panel}>
        <p className="text-sm text-[var(--text-muted)]">Client portal</p>
        <h1 className="text-2xl font-semibold">Your operational visibility</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Authorized site reports and incidents. This portal is read-only.
        </p>
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
