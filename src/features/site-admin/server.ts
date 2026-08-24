import "server-only";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type PrincipalResolver,
} from "@/server/request/context";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresSiteAdminRepository } from "./postgres-repository";
import { SiteAdminService } from "./service";
export async function createSiteAdminService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new SiteAdminService(
    new AuthorizedDataAccess(context),
    new PostgresSiteAdminRepository(databaseFactory()),
  );
}
