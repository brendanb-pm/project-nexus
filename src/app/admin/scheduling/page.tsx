import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { SchedulingAdmin } from "@/components/admin/scheduling-admin";
import { loadSchedulingAdminPage } from "@/features/scheduling/application";
import { createSchedulingService } from "@/features/scheduling/server";
import { measureRequest } from "@/server/performance/telemetry";
import * as actions from "./actions";

export default async function Page() {
  const state = await measureRequest("scheduling-admin.page", async () =>
    loadSchedulingAdminPage(
      createSchedulingService(
        await createProductionPrincipalResolver(),
        "scheduling-admin.page",
      ),
    ),
  );
  return <SchedulingAdmin actions={actions} state={state} />;
}
