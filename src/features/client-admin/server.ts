import "server-only";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type PrincipalResolver,
} from "@/server/request/context";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresClientAdminRepository } from "./postgres-repository";
import { ClientAdminService } from "./service";
export async function createClientAdminService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new ClientAdminService(
    new AuthorizedDataAccess(context),
    new PostgresClientAdminRepository(databaseFactory()),
  );
}
