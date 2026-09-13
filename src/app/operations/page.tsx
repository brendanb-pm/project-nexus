import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { OperationsCenter } from "@/components/operations/operations-center";
import { loadOperationsCenter } from "@/features/operations/application";
import { createOperationsService } from "@/features/operations/server";
import { measureRequest } from "@/server/performance/telemetry";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import { createReportingService } from "@/features/reporting/server";
import { SessionSignOut } from "@/components/auth/session-sign-out";

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
      <SessionSignOut />
      <OperationsCenter state={state} />
    </>
  );
}
