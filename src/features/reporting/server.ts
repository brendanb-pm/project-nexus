import "server-only";
import type { PrincipalResolver } from "@/server/request/context";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresReportingRepository } from "./postgres-repository";
import { ReportingService } from "./service";

export async function createReportingService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new ReportingService(
    new AuthorizedDataAccess(context),
    new PostgresReportingRepository(databaseFactory()),
  );
}
