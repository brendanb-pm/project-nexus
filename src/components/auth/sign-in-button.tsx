"use client";

import { useState } from "react";
import { authClient } from "@/auth/client";
import { NEXUS_OIDC_PROVIDER_ID } from "@/auth/provider";

export function SignInButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setPending(true);
    setFailed(false);
    const result = await authClient.signIn.social({
      provider: NEXUS_OIDC_PROVIDER_ID,
      callbackURL: "/admin/organization",
    });
    if (result.error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div>
      <button
        className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        onClick={signIn}
        type="button"
      >
        {pending ? "Connecting…" : "Sign in"}
      </button>
      {failed ? (
        <p className="mt-3 text-sm text-[var(--warning)]" role="alert">
          Sign-in could not be started. Please try again.
        </p>
      ) : null}
    </div>
  );
}
