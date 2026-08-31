import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { MySchedule } from "@/components/schedule/my-schedule";
import { loadMySchedulePage } from "@/features/scheduling/application";
import { createSchedulingService } from "@/features/scheduling/server";
import { measureRequest } from "@/server/performance/telemetry";
import { clock, createAvailability } from "./actions";

export default async function Page() {
  const state = await measureRequest("my-schedule.page", async () =>
    loadMySchedulePage(
      createSchedulingService(
        await createProductionPrincipalResolver(),
        "my-schedule.page",
      ),
    ),
  );
  return (
    <>
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
      <MySchedule actions={{ clock, createAvailability }} state={state} />
    </>
  );
}
