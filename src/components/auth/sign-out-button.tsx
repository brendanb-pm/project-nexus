"use client";

import { useState } from "react";
import { authClient } from "@/auth/client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      className="text-sm text-[var(--text-muted)] underline disabled:opacity-60"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut({ callbackURL: "/sign-in" });
        setPending(false);
      }}
      type="button"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
