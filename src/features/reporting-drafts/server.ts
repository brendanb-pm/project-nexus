import "server-only";
import type { PrincipalResolver } from "@/server/request/context";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresReportingRepository } from "@/features/reporting/postgres-repository";
import { PostgresReportingDraftRepository } from "./postgres-repository";
import { ReportingDraftService } from "./service";

export async function createReportingDraftService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  const database = databaseFactory();
  return new ReportingDraftService(
    new AuthorizedDataAccess(context),
    new PostgresReportingRepository(database),
    new PostgresReportingDraftRepository(database),
  );
}
