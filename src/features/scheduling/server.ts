import "server-only";

import type { PrincipalResolver } from "@/server/request/context";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresSchedulingRepository } from "./postgres-repository";
import { SchedulingService } from "./service";

export async function createSchedulingService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new SchedulingService(
    new AuthorizedDataAccess(context),
    new PostgresSchedulingRepository(databaseFactory()),
  );
}
