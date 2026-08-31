import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";

export function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-white/10 bg-[var(--sidebar)] p-5 md:border-b-0 md:border-r">
        <span className="font-semibold">NEXUS</span>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Security Operations
        </p>
        {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
      </aside>
      <main className="p-4 md:p-8">{children}</main>
    </div>
  );
}
