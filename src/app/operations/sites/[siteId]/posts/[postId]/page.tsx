import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import {
  PostScorecard,
  ScorecardUnavailable,
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
  params: Promise<{ siteId: string; postId: string }>;
}) {
  const { siteId, postId } = await params;
  const resolver = await createProductionPrincipalResolver();
  const site = await measureRequest("operations.post-scorecard", async () => {
    try {
      const scorecards = await (
        await createOperationsService(resolver, "operations.post-scorecard")
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
  const post = site?.posts.find((item) => item.id === postId);
  return (
    <>
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
      <div className="grid gap-4">
        <a
          href={site ? site.href : "/operations"}
          className="text-sm underline"
        >
          ← Site scorecard
        </a>
        {post ? <PostScorecard post={post} detail /> : <ScorecardUnavailable />}
      </div>
    </>
  );
}
