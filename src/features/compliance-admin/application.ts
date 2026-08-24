import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { ComplianceAdminPageState } from "./contracts";
import type { ComplianceAdminService } from "./service";
export async function loadComplianceAdminPage(
  serviceOrPromise: ComplianceAdminService | Promise<ComplianceAdminService>,
  employeeId?: string,
): Promise<ComplianceAdminPageState> {
  try {
    const service = await serviceOrPromise;
    const employees = await service.listEmployees();
    const selected = employeeId ?? employees[0]?.id;
    return {
      kind: "ready",
      canManage: service.canManage(),
      employees,
      detail: selected ? await service.getEmployeeDetail(selected) : undefined,
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      return {
        kind: "permission-denied",
        message: "You do not have permission to view employee compliance.",
      };
    if (error instanceof ResourceNotFoundError)
      return {
        kind: "error",
        message: "The selected employee is unavailable.",
        retryable: false,
      };
    return {
      kind: "error",
      message: "Employee compliance is temporarily unavailable.",
      retryable: true,
    };
  }
}
