import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { OperationsCenter } from "@/components/operations/operations-center";
import { loadOperationsCenter } from "@/features/operations/application";
import { createOperationsService } from "@/features/operations/server";
import { measureRequest } from "@/server/performance/telemetry";

export default async function Page() {
  const resolver = await createProductionPrincipalResolver();
  const state = await measureRequest("operations.page", () =>
    loadOperationsCenter(createOperationsService(resolver, "operations.page")),
  );
  return <OperationsCenter state={state} />;
}
