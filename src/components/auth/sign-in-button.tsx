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
    try {
      const result = await authClient.signIn.social({
        provider: NEXUS_OIDC_PROVIDER_ID,
        callbackURL: "/session/continue",
      });
      if (result.error) throw new Error("sign-in-failed");
    } catch {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div>
      <button
        className="rounded-lg bg-[var(--accent-control)] px-4 py-2 font-semibold text-white disabled:opacity-60"
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
