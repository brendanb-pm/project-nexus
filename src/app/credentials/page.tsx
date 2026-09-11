import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { CredentialReadiness } from "@/components/guard/credential-readiness";
import { GuardShell } from "@/components/guard/guard-shell";
import { loadGuardReadiness } from "@/features/guard-readiness/server";
export default async function Page() {
  try {
    return (
      <GuardShell>
        <CredentialReadiness
          state={await loadGuardReadiness(
            await createProductionPrincipalResolver(),
          )}
        />
      </GuardShell>
    );
  } catch {
    return (
      <GuardShell>
        <CredentialReadiness
          state={{ error: "You do not have access to credential readiness." }}
        />
      </GuardShell>
    );
  }
}
