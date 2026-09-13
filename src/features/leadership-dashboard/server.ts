import "server-only";

import type { PrincipalResolver } from "@/server/request/context";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresLeadershipDashboardRepository } from "./postgres-repository";
import { LeadershipDashboardService } from "./service";

export async function createLeadershipDashboardService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new LeadershipDashboardService(
    new AuthorizedDataAccess(context),
    new PostgresLeadershipDashboardRepository(databaseFactory()),
  );
}
