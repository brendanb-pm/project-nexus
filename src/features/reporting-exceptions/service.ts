import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { ReportingExceptionTransition } from "./contracts";
import { isReportingExceptionTransitionAllowed } from "./policy";
import type {
  ReportingExceptionRepository,
  ReportingExceptionScope,
} from "./repository";

const supervisorTransitions = new Set([
  "ACKNOWLEDGED",
  "CORRECTION_REQUESTED",
  "RESOLVED",
]);

export class ReportingExceptionService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: ReportingExceptionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private scope(): ReportingExceptionScope {
    const { context } = this.access;
    return { organizationId: context.organizationId, ...context.scope };
  }

  async listOperations(limit = 50) {
    this.access.requireOrganization("VIEW_SITE_OPERATIONS");
    await this.repository.reconcile(this.scope(), this.now().toISOString());
    return this.repository.list(this.scope(), {
      limit: Math.min(Math.max(limit, 1), 100),
    });
  }

  async dossier(id: string) {
    this.access.requireOrganization("VIEW_SITE_OPERATIONS");
    if (
      !this.access.context.actor.roles.some(
        (role) =>
          role === "OPERATIONS_MANAGER" ||
          role === "ADMIN" ||
          role === "SUPERVISOR",
      )
    )
      throw new PermissionDeniedError();
    const dossier = await this.repository.dossier(this.scope(), id);
    if (!dossier) throw new ResourceNotFoundError("Reporting exception");
    this.access.requireHierarchical("VIEW_SITE_OPERATIONS", dossier.exception);
    return dossier;
  }

  lifecycleRole(): "FULL" | "SUPERVISOR" {
    return this.access.context.actor.roles.some(
      (role) => role === "OPERATIONS_MANAGER" || role === "ADMIN",
    )
      ? "FULL"
      : "SUPERVISOR";
  }

  async listOwn(limit = 25) {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new PermissionDeniedError();
    this.access.require("VIEW_OWN_ASSIGNMENTS", {
      organizationId: this.access.context.organizationId,
      employeeId,
    });
    await this.repository.reconcile(this.scope(), this.now().toISOString());
    return this.repository.list(this.scope(), {
      employeeId,
      limit: Math.min(Math.max(limit, 1), 100),
    });
  }

  async transition(input: ReportingExceptionTransition) {
    if (!input.reason.trim()) throw new Error("A reason is required.");
    const detail = await this.repository.detail(
      this.scope(),
      input.exceptionId,
    );
    if (!detail) throw new ResourceNotFoundError("Reporting exception");
    const resource = detail.exception;
    const isOperationsManager =
      this.access.context.actor.roles.includes("OPERATIONS_MANAGER");
    const isAdmin = this.access.context.actor.roles.includes("ADMIN");
    if (isOperationsManager || isAdmin) {
      this.access.requireHierarchical("MANAGE_REPORTING_EXCEPTIONS", resource);
    } else {
      this.access.requireHierarchical(
        "ACKNOWLEDGE_OPERATIONAL_RECORD",
        resource,
      );
      if (!this.access.context.actor.roles.includes("SUPERVISOR"))
        throw new PermissionDeniedError();
      if (!supervisorTransitions.has(input.nextState))
        throw new PermissionDeniedError();
      if (
        input.nextState === "RESOLVED" &&
        detail.exception.state !== "CORRECTED_PENDING_REVIEW"
      )
        throw new PermissionDeniedError();
      if (input.assigneeUserId) throw new PermissionDeniedError();
    }
    // A retried authorized request that already reached its requested state is
    // a stable no-op. It must not append a duplicate lifecycle or audit event.
    if (resource.state === input.nextState) return detail;
    if (!isReportingExceptionTransitionAllowed(resource.state, input.nextState))
      throw new Error("That reporting-exception transition is not allowed.");
    const result = await this.repository.transition(
      this.scope(),
      input,
      this.access.auditContext(),
    );
    if (!result) throw new ResourceNotFoundError("Reporting exception");
    return result;
  }
}
