import "server-only";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { PostgresOperationsRepository } from "@/features/operations/postgres-repository";
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
  const operations = new PostgresOperationsRepository(getDatabase());
  const asOf = new Date();
  const [activities, incidents, scorecards] = await Promise.all([
    repository.listReviewActivities(scope, ["CLIENT_VISIBLE"], 25),
    repository.listIncidents(scope, ["CLIENT_VISIBLE"], 25),
    operations.listScorecards(scope, {
      startsAt: new Date(asOf.valueOf() - 12 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(asOf.valueOf() + 12 * 60 * 60 * 1000).toISOString(),
      asOf: asOf.toISOString(),
    }),
  ]);
  return {
    coverage: scorecards.sites.map((site) => ({
      id: site.id,
      name: site.name,
      status: site.status,
      coveragePercent: site.coveragePercent,
      currentGapCount: site.currentGapCount,
      upcomingGapCount: site.upcomingGapCount,
      posts: site.posts.map((post) => ({
        id: post.id,
        name: post.name,
        status: post.status,
        coveragePercent: post.coveragePercent,
        currentGapCount: post.currentGaps.length,
        upcomingGapCount: post.upcomingGaps.length,
      })),
    })),
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
