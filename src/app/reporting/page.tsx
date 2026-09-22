import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { GuardShell } from "@/components/guard/guard-shell";
import { ReportingWorkspace } from "@/components/reporting/reporting-workspace";
import { loadReportingPage } from "@/features/reporting/application";
import { createReportingService } from "@/features/reporting/server";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import { measureRequest } from "@/server/performance/telemetry";
import {
  createActivity,
  createIncident,
  submitShiftCloseout,
} from "./actions";
import { setPassdownDismissal } from "../eosr/actions";
export default async function Page() {
  const resolver = await createProductionPrincipalResolver();
  const state = await measureRequest("reporting.page", () =>
    loadReportingPage(createReportingService(resolver, "reporting.page")),
  );
  const passdowns =
    state.kind === "ready" && !state.reviewEnabled
      ? await (
          await createEndOfShiftReportService(resolver, "reporting.passdowns")
        ).listIncomingPassdowns()
      : [];
  const workspace = (
    <>
      <ReportingWorkspace
        state={state}
        actions={{
          createActivity,
          createIncident,
          submitCloseout: submitShiftCloseout,
          setPassdownDismissal,
        }}
        passdowns={passdowns}
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
