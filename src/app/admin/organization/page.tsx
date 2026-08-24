import { AppShell } from "@/components/layout/app-shell";
import { OrganizationBranchAdmin } from "@/components/admin/organization-branch-admin";

export default function OrganizationAdministrationPage() {
  return (
    <AppShell>
      <OrganizationBranchAdmin
        state={{
          kind: "permission-denied",
          message:
            "An authenticated provider membership is required. The provider-neutral authentication adapter is not configured yet.",
        }}
      />
    </AppShell>
  );
}
