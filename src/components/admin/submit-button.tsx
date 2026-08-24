"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  disabled = false,
}: Readonly<{
  children: React.ReactNode;
  disabled?: boolean;
}>) {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
