import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { ClientAdmin } from "@/components/admin/client-admin";
import { loadClientAdminPage } from "@/features/client-admin/application";
import { createClientAdminService } from "@/features/client-admin/server";
import * as actions from "./actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const selected = (await searchParams).client;
  const state = await loadClientAdminPage(
    createClientAdminService(
      await createProductionPrincipalResolver(),
      "client-admin.page",
    ),
    selected,
  );
  return (
    <main className="mx-auto max-w-6xl p-6">
      <ClientAdmin state={state} actions={actions} />
    </main>
  );
}
