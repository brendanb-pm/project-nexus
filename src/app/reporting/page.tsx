import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { ReportingWorkspace } from "@/components/reporting/reporting-workspace";
import { loadReportingPage } from "@/features/reporting/application";
import { createReportingService } from "@/features/reporting/server";
import { measureRequest } from "@/server/performance/telemetry";
import * as actions from "./actions";
export default async function Page() {
  const resolver = await createProductionPrincipalResolver();
  const state = await measureRequest("reporting.page", () =>
    loadReportingPage(createReportingService(resolver, "reporting.page")),
  );
  return <ReportingWorkspace state={state} actions={actions} />;
}
