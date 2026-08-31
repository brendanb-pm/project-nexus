"use client";

import { useState } from "react";

const personas = [
  ["guard-a", "Guard A"],
  ["operations-manager-b", "Operations Manager B"],
] as const;

export function DevelopmentSignIn() {
  const [pending, setPending] = useState("");
  const [failed, setFailed] = useState(false);

  async function signIn(persona: (typeof personas)[number][0]) {
    setPending(persona);
    setFailed(false);
    const response = await fetch(`/api/dev-auth/${persona}`, {
      method: "POST",
    });
    if (!response.ok) {
      setPending("");
      setFailed(true);
      return;
    }

    const { redirectTo } = (await response.json()) as { redirectTo: string };
    window.location.assign(redirectTo);
  }

  return (
    <section className="mt-6 border-t border-white/10 pt-5">
      <h2 className="text-sm font-semibold">Local demo accounts</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Available only in explicit localhost development mode.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {personas.map(([persona, label]) => (
          <button
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={Boolean(pending)}
            key={persona}
            onClick={() => signIn(persona)}
            type="button"
          >
            {pending === persona ? "Signing in…" : `Sign in as ${label}`}
          </button>
        ))}
      </div>
      {failed ? (
        <p className="mt-3 text-sm text-[var(--warning)]" role="alert">
          Local demo sign-in is unavailable. Confirm the local environment is
          configured.
        </p>
      ) : null}
    </section>
  );
}
