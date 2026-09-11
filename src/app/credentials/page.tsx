import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { CredentialReadiness } from "@/components/guard/credential-readiness";
import { GuardShell } from "@/components/guard/guard-shell";
import { loadGuardReadiness } from "@/features/guard-readiness/server";

async function loadPageState() {
  try {
    return await loadGuardReadiness(await createProductionPrincipalResolver());
  } catch {
    return { error: "You do not have access to credential readiness." };
  }
}

export default async function Page() {
  const state = await loadPageState();
  return (
    <GuardShell>
      <CredentialReadiness state={state} />
    </GuardShell>
  );
}
