import "server-only";
import type { PrincipalResolver } from "@/server/request/context";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresCoverageRepository } from "./postgres-repository";
import { CoverageService } from "./service";

export async function createCoverageService(resolver: PrincipalResolver, operation: string, databaseFactory: () => NexusDatabase = getDatabase) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new CoverageService(new AuthorizedDataAccess(context), new PostgresCoverageRepository(databaseFactory()));
}
