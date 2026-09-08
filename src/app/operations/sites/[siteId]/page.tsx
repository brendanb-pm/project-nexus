import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import {
  ScorecardUnavailable,
  SiteScorecard,
} from "@/components/operations/scorecards";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { createOperationsService } from "@/features/operations/server";
import { measureRequest } from "@/server/performance/telemetry";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";

export default async function Page({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const resolver = await createProductionPrincipalResolver();
  const site = await measureRequest("operations.site-scorecard", async () => {
    try {
      const scorecards = await (
        await createOperationsService(resolver, "operations.site-scorecard")
      ).listScorecards();
      return scorecards.sites.find((item) => item.id === siteId);
    } catch (error) {
      if (
        error instanceof AuthenticationRequiredError ||
        error instanceof PermissionDeniedError
      )
        return undefined;
      throw error;
    }
  });
  return (
    <>
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
      <div className="grid gap-4">
        <a href="/operations" className="text-sm underline">
          ← Operations
        </a>
        {site ? <SiteScorecard site={site} detail /> : <ScorecardUnavailable />}
      </div>
    </>
  );
}
