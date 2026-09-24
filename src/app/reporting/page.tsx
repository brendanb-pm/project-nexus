import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { GuardShell } from "@/components/guard/guard-shell";
import { ReportingWorkspace } from "@/components/reporting/reporting-workspace";
import { loadReportingPage } from "@/features/reporting/application";
import { createReportingService } from "@/features/reporting/server";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import { createReportingExceptionService } from "@/features/reporting-exceptions/server";
import { measureRequest } from "@/server/performance/telemetry";
import { createActivity, createIncident, submitShiftCloseout } from "./actions";
import { setPassdownDismissal } from "../eosr/actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ assignmentId?: string }>;
}) {
  const resolver = await createProductionPrincipalResolver();
  const params = await searchParams;
  const state = await measureRequest("reporting.page", () =>
    loadReportingPage(
      createReportingService(resolver, "reporting.page"),
      params.assignmentId,
    ),
  );
  const personalExceptions =
    state.kind === "ready" && !state.reviewEnabled
      ? await (
          await createReportingExceptionService(
            resolver,
            "reporting.personal-exceptions",
          )
        ).listOwn()
      : [];
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
        draftEnabled
        actions={{
          createActivity,
          createIncident,
          submitCloseout: submitShiftCloseout,
          setPassdownDismissal,
        }}
        correctionMode={Boolean(params.assignmentId)}
        passdowns={passdowns}
        reportingExceptions={personalExceptions}
      />
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
    </>
  );
  return state.kind !== "ready" || state.reviewEnabled ? (
    <main className="mx-auto max-w-6xl p-4 md:p-8">{workspace}</main>
  ) : (
    <GuardShell>{workspace}</GuardShell>
  );
}
