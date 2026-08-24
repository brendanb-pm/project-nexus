import { AppShell } from "@/components/layout/app-shell";
import { OrganizationBranchAdmin } from "@/components/admin/organization-branch-admin";
import { loadOrganizationAdminPage } from "@/features/organization-admin/application";
import { createOrganizationAdminService } from "@/features/organization-admin/server";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createBranch, updateBranch, updateOrganization } from "./actions";

export default async function OrganizationAdministrationPage() {
  const service = createProductionPrincipalResolver().then((resolver) =>
    createOrganizationAdminService(resolver, "organization-admin.read"),
  );
  const state = await loadOrganizationAdminPage(service);

  return (
    <AppShell>
      <OrganizationBranchAdmin
        actions={
          state.kind === "ready"
            ? { createBranch, updateBranch, updateOrganization }
            : undefined
        }
        state={state}
      />
    </AppShell>
  );
}
