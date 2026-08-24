"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <section
        role="alert"
        className="rounded-xl border border-white/10 bg-[var(--card)] p-5"
      >
        <h1 className="text-2xl font-semibold">
          Site administration unavailable
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          No changes were assumed. Retry to load authoritative data.
        </p>
        <button
          className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2"
          onClick={reset}
        >
          Retry
        </button>
      </section>
    </main>
  );
}
