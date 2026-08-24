import "server-only";

import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type PrincipalResolver,
} from "@/server/request/context";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresOrganizationAdminRepository } from "./postgres-repository";
import { OrganizationAdminService } from "./service";

export async function createOrganizationAdminService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
): Promise<OrganizationAdminService> {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new OrganizationAdminService(
    new AuthorizedDataAccess(context),
    new PostgresOrganizationAdminRepository(databaseFactory()),
  );
}
