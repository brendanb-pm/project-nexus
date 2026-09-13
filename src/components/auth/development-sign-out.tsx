"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DevelopmentSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/dev-auth/guard-a", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("sign-out-failed");
      router.push("/sign-in");
      router.refresh();
    } catch {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div>
      <button
        className="mt-5 min-h-11 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold disabled:opacity-60"
        disabled={pending}
        onClick={signOut}
        type="button"
      >
        {pending ? "Signing out…" : "Sign out of local demo"}
      </button>
      {failed ? (
        <p className="mt-2 text-sm text-[var(--warning)]" role="alert">
          Sign-out could not be completed. Please try again.
        </p>
      ) : null}
    </div>
  );
}
