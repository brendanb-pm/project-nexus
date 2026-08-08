import { AppShell } from "@/components/layout/app-shell";

export default function Home() {
  return (
    <AppShell>
      <section className="rounded-xl border border-white/10 bg-[var(--card)] p-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">
          Foundation ready
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Project Nexus</h1>
        <p className="mt-3 max-w-2xl text-[var(--text-muted)]">
          A secure operations platform foundation for uniformed site protection.
          Feature workflows will be delivered on scoped feature branches.
        </p>
      </section>
    </AppShell>
  );
}
