import { ClientPortal } from "@/components/client/client-portal";
import { loadClientPortal } from "@/features/client-portal/server";
export default async function Page() {
  let state;
  try {
    state = await loadClientPortal();
  } catch {
    state = { error: "You do not have access to this client portal." };
  }
  return (
    <main className="mx-auto max-w-6xl p-6">
      <ClientPortal state={state} />
    </main>
  );
}
