import { ReportingHub } from "@/components/reporting/reporting-hub";
import { loadReportingHub } from "@/features/reporting-hub/application";
import { createReportingHubService } from "@/features/reporting-hub/server";
import { measureRequest } from "@/server/performance/telemetry";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    siteId?: string;
    family?: string;
    status?: string;
    window?: string;
    cursor?: string;
  }>;
}) {
  const params = await searchParams;
  const state = await measureRequest("reports.page", () =>
    loadReportingHub(createReportingHubService(), params),
  );
  return <ReportingHub state={state} />;
}
