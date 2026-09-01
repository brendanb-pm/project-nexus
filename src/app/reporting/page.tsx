import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { ReportingWorkspace } from "@/components/reporting/reporting-workspace";
import { loadReportingPage } from "@/features/reporting/application";
import { createReportingService } from "@/features/reporting/server";
import { measureRequest } from "@/server/performance/telemetry";
import {
  acknowledgeOperationalRecord,
  amendOperationalRecord,
  createActivity,
  createIncident,
  getOperationalRecord,
} from "./actions";
export default async function Page() {
  const resolver = await createProductionPrincipalResolver();
  const state = await measureRequest("reporting.page", () =>
    loadReportingPage(createReportingService(resolver, "reporting.page")),
  );
  return (
    <>
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
      <ReportingWorkspace
        state={state}
        actions={{
          acknowledgeOperationalRecord,
          amendOperationalRecord,
          createActivity,
          createIncident,
          getOperationalRecord,
        }}
      />
    </>
  );
}
