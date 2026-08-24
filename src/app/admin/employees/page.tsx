import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { PeopleAdmin } from "@/components/admin/people-admin";
import { loadPeopleAdminPage } from "@/features/people-admin/application";
import { createPeopleAdminService } from "@/features/people-admin/server";
import { measureRequest } from "@/server/performance/telemetry";
import * as actions from "./actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const state = await measureRequest("people-admin.page", async () => {
    const selected = (await searchParams).employee;
    return loadPeopleAdminPage(
      createPeopleAdminService(
        await createProductionPrincipalResolver(),
        "people-admin.page",
      ),
      selected,
    );
  });
  return (
    <main className="mx-auto max-w-6xl p-6">
      <PeopleAdmin actions={actions} state={state} />
    </main>
  );
}
