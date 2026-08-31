import "server-only";

import type { PrincipalResolver } from "@/server/request/context";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresOperationsRepository } from "./postgres-repository";
import { OperationsService } from "./service";

export async function createOperationsService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new OperationsService(
    new AuthorizedDataAccess(context),
    new PostgresOperationsRepository(databaseFactory()),
  );
}
