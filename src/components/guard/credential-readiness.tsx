import Link from "next/link";
const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
export function CredentialReadiness({
  state,
}: {
  state:
    | {
        credentials: readonly {
          id: string;
          displayName: string;
          state: string;
          expiresOn?: string;
        }[];
        readiness: {
          items: readonly {
            id: string;
            priority: string;
            credentialName: string;
            actionStatus: string;
            assignment?: unknown;
          }[];
        };
        assignments: readonly unknown[];
      }
    | { error: string };
}) {
  if ("error" in state)
    return (
      <section className={panel} role="alert">
        <h1 className="text-xl font-semibold">
          Credential readiness unavailable
        </h1>
        <p className="mt-2">{state.error}</p>
      </section>
    );
  const blocking = state.readiness.items.filter(
    (item) => item.priority === "BLOCKING_ASSIGNMENT",
  );
  return (
    <div className="grid gap-5">
      <section className={panel}>
        <p className="text-sm text-[var(--text-muted)]">Your credentials</p>
        <h1 className="text-2xl font-semibold">Credential readiness</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          {blocking.length
            ? "Action needed for an upcoming assignment."
            : state.assignments.length
              ? "Ready for your upcoming scheduled shifts."
              : "No upcoming assignments are scheduled."}
        </p>
      </section>
      {blocking.map((item) => (
        <section
          className={`${panel} border-l-4 border-red-400/70`}
          key={item.id}
        >
          <h2 className="font-semibold">
            Action needed — {item.credentialName}
          </h2>
          <p className="mt-2 text-sm">{item.actionStatus}</p>
          <Link
            className="mt-3 inline-flex min-h-12 items-center underline"
            href="/schedule"
          >
            View affected shift
          </Link>
        </section>
      ))}
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">My credentials</h2>
        {state.credentials.length ? (
          state.credentials.map((credential) => (
            <article className={panel} key={credential.id}>
              <h3 className="font-semibold">{credential.displayName}</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {credential.state.replaceAll("_", " ")}
                {credential.expiresOn
                  ? ` · Expires ${credential.expiresOn}`
                  : ""}
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {credential.state === "pending_verification"
                  ? "Awaiting authorized verification. Contact Operations to update this credential."
                  : "Evidence status is managed by Operations."}
              </p>
            </article>
          ))
        ) : (
          <section className={panel}>
            No credentials are on file. Contact Operations if a required
            credential is missing.
          </section>
        )}
      </section>
    </div>
  );
}
