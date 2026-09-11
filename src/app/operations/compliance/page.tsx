import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { ComplianceWorkspace } from "@/components/operations/compliance-workspace";
import { loadComplianceWorkspace } from "@/features/compliance-workspace/application";
import { createComplianceWorkspaceService } from "@/features/compliance-workspace/server";
import { measureRequest } from "@/server/performance/telemetry";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const resolver = await createProductionPrincipalResolver();
  const state = await measureRequest("operations.compliance.page", () =>
    loadComplianceWorkspace(
      createComplianceWorkspaceService(resolver, "operations.compliance.page"),
    ),
  );
  return (
    <ComplianceWorkspace
      employeeId={(await searchParams).employee}
      state={state}
    />
  );
}
