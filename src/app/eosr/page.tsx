import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { EndOfShiftReportForm } from "@/components/eosr/end-of-shift-report-form";
import { createReportingService } from "@/features/reporting/server";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import { setPassdownDismissal, submitEndOfShiftReport } from "./actions";
export default async function Page() {
  const resolver = await createProductionPrincipalResolver();
  const service = await createReportingService(resolver, "eosr.page");
  const eosr = await createEndOfShiftReportService(resolver, "eosr.passdowns");
  return (
    <>
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
      <EndOfShiftReportForm
        assignments={await service.listOwnAssignments()}
        passdowns={await eosr.listIncomingPassdowns()}
        submit={submitEndOfShiftReport}
        setPassdownDismissal={setPassdownDismissal}
      />
    </>
  );
}
