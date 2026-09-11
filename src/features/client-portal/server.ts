import "server-only";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { PostgresReportingRepository } from "@/features/reporting/postgres-repository";
import { getDatabase } from "@/server/db/client";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";

export async function loadClientPortal() {
  const context = await createAuthenticatedRequestContext(
    await createProductionPrincipalResolver(),
    "client-portal.page",
  );
  const access = new AuthorizedDataAccess(context);
  access.requireOrganization("VIEW_CLIENT_REPORTS");
  access.requireOrganization("VIEW_CLIENT_INCIDENTS");
  const scope = { organizationId: context.organizationId, ...context.scope };
  const repository = new PostgresReportingRepository(getDatabase());
  const [activities, incidents] = await Promise.all([
    repository.listReviewActivities(scope, ["CLIENT_VISIBLE"], 25),
    repository.listIncidents(scope, ["CLIENT_VISIBLE"], 25),
  ]);
  return {
    reports: activities.map((item) => ({
      id: item.id,
      site: item.siteName,
      post: item.postName,
      occurredAt: item.occurredAt,
      category: item.category,
      narrative: item.narrative,
      actionTaken: item.actionTaken,
    })),
    incidents: incidents.map((item) => ({
      id: item.id,
      site: item.siteName,
      post: item.postName,
      occurredAt: item.occurredAt,
      number: item.incidentNumber,
      severity: item.severity,
      narrative: item.narrative,
      actionsTaken: item.actionsTaken,
    })),
  };
}
