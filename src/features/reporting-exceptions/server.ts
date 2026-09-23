import "server-only";

import type { PrincipalResolver } from "@/server/request/context";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresReportingExceptionRepository } from "./postgres-repository";
import { ReportingExceptionService } from "./service";

export async function createReportingExceptionService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new ReportingExceptionService(
    new AuthorizedDataAccess(context),
    new PostgresReportingExceptionRepository(databaseFactory()),
  );
}
