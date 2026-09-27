"use client";

export default function ErrorState({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-4xl p-6" role="alert">
      <h1 className="text-2xl font-semibold">Published report unavailable</h1>
      <p className="mt-2">
        The report could not be loaded. No unpublished information is available
        here.
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
