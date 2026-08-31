import { SignInButton } from "@/components/auth/sign-in-button";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { DevelopmentSignIn } from "@/components/auth/development-sign-in";

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="w-full max-w-md rounded-xl border border-white/10 bg-[var(--card)] p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">
          Project Nexus
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mb-5 mt-2 text-[var(--text-muted)]">
          Use your organization’s approved identity provider. Authentication
          does not grant access without an active Nexus membership.
        </p>
        <SignInButton />
        {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignIn /> : null}
      </section>
    </main>
  );
}
