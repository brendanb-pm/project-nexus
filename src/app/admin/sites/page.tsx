import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { SitePostAdmin } from "@/components/admin/site-post-admin";
import { loadSiteAdminPage } from "@/features/site-admin/application";
import { createSiteAdminService } from "@/features/site-admin/server";
import * as actions from "./actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const selected = (await searchParams).site;
  const state = await loadSiteAdminPage(
    createSiteAdminService(
      await createProductionPrincipalResolver(),
      "site-admin.page",
    ),
    selected,
  );
  return (
    <main className="mx-auto max-w-6xl p-6">
      <SitePostAdmin state={state} actions={actions} />
    </main>
  );
}
