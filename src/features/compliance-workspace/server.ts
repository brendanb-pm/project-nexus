import "server-only";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type PrincipalResolver,
} from "@/server/request/context";
import { PostgresComplianceWorkspaceRepository } from "./postgres-repository";
import { ComplianceWorkspaceService } from "./service";

export async function createComplianceWorkspaceService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new ComplianceWorkspaceService(
    new AuthorizedDataAccess(context),
    new PostgresComplianceWorkspaceRepository(databaseFactory()),
  );
}
