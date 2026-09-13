"use client";

import { useState } from "react";
import { authClient } from "@/auth/client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signOut({ callbackURL: "/sign-in" });
      if (result.error) throw new Error("sign-out-failed");
    } catch {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div>
      <button
        className="min-h-11 text-sm text-[var(--text-muted)] underline disabled:opacity-60"
        disabled={pending}
        onClick={signOut}
        type="button"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {failed ? (
        <p className="mt-2 text-sm text-[var(--warning)]" role="alert">
          Sign-out could not be completed. Please try again.
        </p>
      ) : null}
    </div>
  );
}
