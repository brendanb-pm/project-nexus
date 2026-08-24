import "server-only";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type PrincipalResolver,
} from "@/server/request/context";
import { PostgresComplianceAdminRepository } from "./postgres-repository";
import { ComplianceAdminService } from "./service";
export async function createComplianceAdminService(
  resolver: PrincipalResolver,
  operation: string,
  databaseFactory: () => NexusDatabase = getDatabase,
) {
  const context = await createAuthenticatedRequestContext(resolver, operation);
  return new ComplianceAdminService(
    new AuthorizedDataAccess(context),
    new PostgresComplianceAdminRepository(databaseFactory()),
  );
}
