import "server-only";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type PrincipalResolver,
} from "@/server/request/context";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { PostgresAssetRepository } from "./postgres-repository";
import { AssetService } from "./service";
export async function createAssetService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new AssetService(
    new AuthorizedDataAccess(context),
    new PostgresAssetRepository(databaseFactory()),
  );
}
