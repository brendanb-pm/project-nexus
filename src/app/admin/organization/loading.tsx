import { AppShell } from "@/components/layout/app-shell";
import { OrganizationBranchAdmin } from "@/components/admin/organization-branch-admin";

export default function Loading() {
  return (
    <AppShell>
      <OrganizationBranchAdmin state={{ kind: "loading" }} />
    </AppShell>
  );
}
