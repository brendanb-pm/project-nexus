import { ReportingAnalyticsView } from "@/components/reporting/reporting-analytics";
import { loadReportingAnalytics } from "@/features/reporting-analytics/application";
import { createReportingAnalyticsService } from "@/features/reporting-analytics/server";
import { measureRequest } from "@/server/performance/telemetry";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    window?: string;
    sitePage?: string;
    branchId?: string;
    clientId?: string;
    siteId?: string;
    incidentClassification?: string;
    incidentSeverity?: string;
    incidentStatus?: string;
  }>;
}) {
  const params = await searchParams;
  const state = await measureRequest("reports.analytics.page", () =>
    loadReportingAnalytics(createReportingAnalyticsService(), params),
  );
  return <ReportingAnalyticsView state={state} />;
}
