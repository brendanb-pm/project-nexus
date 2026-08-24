import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type { PeopleAdminPageState } from "./contracts";
import type { PeopleAdminService } from "./service";
export async function loadPeopleAdminPage(
  serviceOrPromise: PeopleAdminService | Promise<PeopleAdminService>,
  selectedId?: string,
): Promise<PeopleAdminPageState> {
  try {
    const service = await serviceOrPromise;
    const canManage = service.canManage();
    const [branches, employees, users] = await Promise.all([
      service.listBranches(),
      service.listEmployees(),
      canManage ? service.listLinkableUsers() : Promise.resolve([]),
    ]);
    const selected = selectedId ?? employees.items[0]?.id;
    return {
      kind: "ready",
      canManage,
      branches,
      employees,
      users,
      detail: selected ? await service.getEmployee(selected) : undefined,
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      return {
        kind: "permission-denied",
        message: "You do not have permission to view employee records.",
      };
    if (error instanceof ResourceNotFoundError)
      return {
        kind: "error",
        message: "The selected employee is unavailable.",
        retryable: false,
      };
    return {
      kind: "error",
      message: "Employee administration is temporarily unavailable.",
      retryable: true,
    };
  }
}
