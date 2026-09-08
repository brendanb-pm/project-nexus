"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/home", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/reporting", label: "Report" },
  { href: "/more", label: "More" },
] as const;

export function GuardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="border-b border-white/10 bg-[var(--sidebar)] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link className="text-sm font-bold tracking-[0.16em]" href="/home">
            NEXUS
          </Link>
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Guard operations
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">
        {children}
      </main>
      <nav
        aria-label="Guard navigation"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[var(--sidebar)]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:sticky md:top-0 md:mx-auto md:mt-6 md:max-w-6xl md:rounded-xl md:border"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 md:max-w-none">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/reporting" && pathname === "/eosr");
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center justify-center rounded-lg px-3 text-sm font-semibold ${active ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:bg-white/5 hover:text-white"}`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
