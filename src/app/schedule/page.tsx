import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { MySchedule } from "@/components/schedule/my-schedule";
import { loadMySchedulePage } from "@/features/scheduling/application";
import { createSchedulingService } from "@/features/scheduling/server";
import { measureRequest } from "@/server/performance/telemetry";
import * as actions from "./actions";

export default async function Page() {
  const state = await measureRequest("my-schedule.page", async () =>
    loadMySchedulePage(
      createSchedulingService(
        await createProductionPrincipalResolver(),
        "my-schedule.page",
      ),
    ),
  );
  return <MySchedule actions={actions} state={state} />;
}
