import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { ClientAdmin } from "@/components/admin/client-admin";
import { loadClientAdminPage } from "@/features/client-admin/application";
import { createClientAdminService } from "@/features/client-admin/server";
import { measureRequest } from "@/server/performance/telemetry";
import * as actions from "./actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const state = await measureRequest("client-admin.page", async () => {
    const selected = (await searchParams).client;
    return loadClientAdminPage(
      createClientAdminService(
        await createProductionPrincipalResolver(),
        "client-admin.page",
      ),
      selected,
    );
  });
  return (
    <main className="mx-auto max-w-6xl p-6">
      <ClientAdmin state={state} actions={actions} />
    </main>
  );
}
