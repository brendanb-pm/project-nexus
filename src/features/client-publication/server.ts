import "server-only";

import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { PostgresClientPublicationRepository } from "./postgres-repository";
import { ClientPublicationService } from "./service";

export async function createClientPublicationService(
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(
    await createProductionPrincipalResolver(),
    operation,
  );
  return new ClientPublicationService(
    new AuthorizedDataAccess(context),
    new PostgresClientPublicationRepository(databaseFactory()),
  );
}
