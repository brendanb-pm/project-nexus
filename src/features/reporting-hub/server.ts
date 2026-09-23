import "server-only";

import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { getDatabase } from "@/server/db/client";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type PrincipalResolver,
} from "@/server/request/context";
import { PostgresReportingHubRepository } from "./postgres-repository";
import { ReportingHubService } from "./service";

export async function createReportingHubService(
  resolver?: PrincipalResolver,
  operation = "reports.page",
) {
  const context = await createAuthenticatedRequestContext(
    resolver ?? (await createProductionPrincipalResolver()),
    operation,
  );
  return new ReportingHubService(
    new AuthorizedDataAccess(context),
    new PostgresReportingHubRepository(getDatabase()),
  );
}
