"use client";

export default function ErrorState({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-5xl p-6" role="alert">
      <h1 className="text-2xl font-semibold">
        Client report composition unavailable
      </h1>
      <p className="mt-2">
        No draft or publication was changed by this page load. Try again or
        contact Operations support.
      </p>
      <button
        className="mt-4 rounded border border-white/20 px-4 py-2"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  );
}
