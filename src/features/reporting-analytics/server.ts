import "server-only";

import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { getDatabase } from "@/server/db/client";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { PostgresReportingAnalyticsRepository } from "./postgres-repository";
import { ReportingAnalyticsService } from "./service";

export async function createReportingAnalyticsService() {
  const context = await createAuthenticatedRequestContext(
    await createProductionPrincipalResolver(),
    "reports.analytics.page",
  );
  return new ReportingAnalyticsService(
    new AuthorizedDataAccess(context),
    new PostgresReportingAnalyticsRepository(getDatabase()),
  );
}
