import { ClientPortal } from "@/components/client/client-portal";
import { loadClientPortal } from "@/features/client-portal/server";
import { SessionSignOut } from "@/components/auth/session-sign-out";
export default async function Page() {
  let state;
  try {
    state = await loadClientPortal();
  } catch {
    state = { error: "You do not have access to this client portal." };
  }
  return (
    <main className="mx-auto max-w-6xl p-6">
      <SessionSignOut />
      <ClientPortal state={state} />
    </main>
  );
}
