import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { MySchedule } from "@/components/schedule/my-schedule";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import { loadMySchedulePage } from "@/features/scheduling/application";
import { createSchedulingService } from "@/features/scheduling/server";
import { measureRequest } from "@/server/performance/telemetry";
import { setPassdownDismissal } from "../eosr/actions";
import { clock, createAvailability } from "./actions";

export default async function Page() {
  const resolver = await createProductionPrincipalResolver();
  const [state, passdowns] = await Promise.all([
    measureRequest("my-schedule.page", async () =>
      loadMySchedulePage(createSchedulingService(resolver, "my-schedule.page")),
    ),
    (
      await createEndOfShiftReportService(
        resolver,
        "my-schedule.incoming-passdowns",
      )
    ).listIncomingPassdowns(),
  ]);
  return (
    <>
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
      <MySchedule
        actions={{ clock, createAvailability, setPassdownDismissal }}
        passdowns={passdowns}
        state={state}
      />
    </>
  );
}
