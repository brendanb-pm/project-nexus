import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { ComplianceAdmin } from "@/components/admin/compliance-admin";
import { loadComplianceAdminPage } from "@/features/compliance-admin/application";
import { createComplianceAdminService } from "@/features/compliance-admin/server";
import { measureRequest } from "@/server/performance/telemetry";
import * as actions from "./actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const state = await measureRequest("compliance.page", async () => {
    const selected = (await searchParams).employee;
    return loadComplianceAdminPage(
      createComplianceAdminService(
        await createProductionPrincipalResolver(),
        "compliance.page",
      ),
      selected,
    );
  });
  return (
    <main className="mx-auto max-w-6xl p-6">
      <ComplianceAdmin actions={actions} state={state} />
    </main>
  );
}
