import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { GuardShell } from "@/components/guard/guard-shell";
import { ReportingWorkspace } from "@/components/reporting/reporting-workspace";
import { loadReportingPage } from "@/features/reporting/application";
import { createReportingService } from "@/features/reporting/server";
import { measureRequest } from "@/server/performance/telemetry";
import { createActivity, createIncident } from "./actions";
export default async function Page() {
  const resolver = await createProductionPrincipalResolver();
  const state = await measureRequest("reporting.page", () =>
    loadReportingPage(createReportingService(resolver, "reporting.page")),
  );
  const workspace = (
    <>
      <ReportingWorkspace
        state={state}
        actions={{
          createActivity,
          createIncident,
        }}
      />
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
    </>
  );
  return state.kind === "ready" && state.reviewEnabled ? (
    workspace
  ) : (
    <GuardShell>{workspace}</GuardShell>
  );
}
