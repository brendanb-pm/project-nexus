import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { OperationsCenter } from "@/components/operations/operations-center";
import { loadOperationsCenter } from "@/features/operations/application";
import { createOperationsService } from "@/features/operations/server";
import { measureRequest } from "@/server/performance/telemetry";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import { createReportingService } from "@/features/reporting/server";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";

export default async function Page() {
  const resolver = await createProductionPrincipalResolver();
  const state = await measureRequest("operations.page", () =>
    loadOperationsCenter(
      createOperationsService(resolver, "operations.page"),
      createEndOfShiftReportService(resolver, "operations.completed-eosr"),
      createReportingService(resolver, "operations.record-workflow"),
    ),
  );
  return (
    <>
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
      <OperationsCenter state={state} />
    </>
  );
}
