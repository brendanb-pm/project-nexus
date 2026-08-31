"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DevelopmentSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/dev-auth/guard-a", { method: "DELETE" });
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <button
      className="mt-5 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold disabled:opacity-60"
      disabled={pending}
      onClick={signOut}
      type="button"
    >
      {pending ? "Signing out…" : "Sign out of local demo"}
    </button>
  );
}
