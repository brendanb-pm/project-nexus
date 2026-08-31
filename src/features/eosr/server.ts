import "server-only";
import type { PrincipalResolver } from "@/server/request/context";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresEndOfShiftReportRepository } from "./postgres-repository";
import { EndOfShiftReportService } from "./service";

export async function createEndOfShiftReportService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new EndOfShiftReportService(
    new AuthorizedDataAccess(context),
    new PostgresEndOfShiftReportRepository(databaseFactory()),
  );
}
