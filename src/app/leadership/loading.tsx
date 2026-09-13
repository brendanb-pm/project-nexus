export default function Loading() {
  return (
    <section
      className="rounded-xl border border-white/10 bg-[var(--card)] p-5"
      aria-busy="true"
    >
      <h1 className="text-xl font-semibold">Loading leadership operations</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        Loading the authorized operational portfolio.
      </p>
    </section>
  );
}
