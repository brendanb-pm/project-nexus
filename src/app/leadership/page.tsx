import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { LeadershipDashboardView } from "@/components/leadership/leadership-dashboard";
import { loadLeadershipDashboard } from "@/features/leadership-dashboard/application";
import { createLeadershipDashboardService } from "@/features/leadership-dashboard/server";
import { measureRequest } from "@/server/performance/telemetry";
import { SessionSignOut } from "@/components/auth/session-sign-out";

function filter(value: string | undefined) {
  return value && value.trim() ? value : undefined;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; siteId?: string }>;
}) {
  const params = await searchParams;
  const resolver = await createProductionPrincipalResolver();
  const state = await measureRequest("leadership.page", () =>
    loadLeadershipDashboard(
      createLeadershipDashboardService(resolver, "leadership.page"),
      { clientId: filter(params.clientId), siteId: filter(params.siteId) },
    ),
  );
  return (
    <>
      <SessionSignOut />
      <LeadershipDashboardView state={state} />
    </>
  );
}
