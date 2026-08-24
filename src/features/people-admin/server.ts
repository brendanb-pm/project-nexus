import "server-only";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type PrincipalResolver,
} from "@/server/request/context";
import { PostgresPeopleAdminRepository } from "./postgres-repository";
import { PeopleAdminService } from "./service";
export async function createPeopleAdminService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new PeopleAdminService(
    new AuthorizedDataAccess(context),
    new PostgresPeopleAdminRepository(databaseFactory()),
  );
}
