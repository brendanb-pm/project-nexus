import "server-only";
import { PostgresComplianceWorkspaceRepository } from "@/features/compliance-workspace/postgres-repository";
import { buildComplianceWorkspace } from "@/features/compliance-workspace/workspace";
import { getDatabase } from "@/server/db/client";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type PrincipalResolver,
} from "@/server/request/context";
import { ResourceNotFoundError } from "@/server/request/errors";
export async function loadGuardReadiness(resolver: PrincipalResolver) {
  const context = await createAuthenticatedRequestContext(
    resolver,
    "guard-credentials.page",
  );
  const access = new AuthorizedDataAccess(context);
  const employeeId = context.scope.employeeId;
  if (!employeeId) throw new ResourceNotFoundError("Employee relationship");
  access.require("VIEW_OWN_CREDENTIALS", {
    organizationId: context.organizationId,
    employeeId,
  });
  const source = await new PostgresComplianceWorkspaceRepository(
    getDatabase(),
  ).load(
    {
      organizationId: context.organizationId,
      organizationWide: false,
      branchIds: context.scope.branchIds,
      clientIds: context.scope.clientIds,
      siteIds: context.scope.siteIds,
    },
    new Date().toISOString(),
  );
  const own = {
    credentials: source.credentials.filter(
      (item) => item.employeeId === employeeId,
    ),
    requirements: source.requirements,
    assignments: source.assignments.filter(
      (item) => item.employeeId === employeeId,
    ),
  };
  return {
    credentials: own.credentials,
    readiness: buildComplianceWorkspace(own),
    assignments: own.assignments,
  };
}
