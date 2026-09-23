export default function Loading() {
  return (
    <main
      className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:px-8"
      aria-busy="true"
    >
      <div className="h-32 animate-pulse rounded-xl bg-white/10" />
      <div className="h-56 animate-pulse rounded-xl bg-white/10" />
      <p className="text-sm text-[var(--text-muted)]">
        Loading authorized reports…
      </p>
    </main>
  );
}
