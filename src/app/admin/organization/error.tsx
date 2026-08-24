"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="m-4 rounded-xl border border-white/10 bg-[var(--card)] p-6 md:m-8">
      <h1 className="text-2xl font-semibold">Unable to load administration</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        The request could not be completed. Your changes were not confirmed.
      </p>
      <button
        className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </main>
  );
}
