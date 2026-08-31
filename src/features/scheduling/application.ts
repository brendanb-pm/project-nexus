import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";
import type {
  MySchedulePageState,
  SchedulingAdminPageState,
} from "./contracts";
import type { SchedulingService } from "./service";

export async function loadSchedulingAdminPage(
  serviceOrPromise: SchedulingService | Promise<SchedulingService>,
): Promise<SchedulingAdminPageState> {
  try {
    const service = await serviceOrPromise;
    const [shifts, assignments, posts, employees] = await Promise.all([
      service.listShifts(),
      service.listAssignments(),
      service.listPostOptions(),
      service.listEmployeeOptions(),
    ]);
    return { kind: "ready", shifts, assignments, posts, employees };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    ) {
      return {
        kind: "permission-denied",
        message: "You do not have permission to manage scheduling.",
      };
    }
    return {
      kind: "error",
      message: "Scheduling is temporarily unavailable.",
      retryable: !(error instanceof ResourceNotFoundError),
    };
  }
}

export async function loadMySchedulePage(
  serviceOrPromise: SchedulingService | Promise<SchedulingService>,
): Promise<MySchedulePageState> {
  try {
    const service = await serviceOrPromise;
    const [assignments, availability] = await Promise.all([
      service.listOwnAssignments(),
      service.listOwnAvailability(),
    ]);
    const contexts = await Promise.all(
      assignments.map((assignment) =>
        service.getOwnClockContext(assignment.id),
      ),
    );
    return {
      kind: "ready",
      assignments,
      availability,
      clockStates: Object.fromEntries(
        assignments.map((assignment, index) => [
          assignment.id,
          contexts[index]!.events.at(-1)?.eventType === "CLOCK_IN"
            ? "CLOCK_OUT"
            : "CLOCK_IN",
        ]),
      ),
      clockEvents: Object.fromEntries(
        assignments.map((assignment, index) => [
          assignment.id,
          contexts[index]!.events,
        ]),
      ),
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError ||
      error instanceof ResourceNotFoundError
    ) {
      return {
        kind: "permission-denied",
        message: "Your employee schedule is unavailable for this account.",
      };
    }
    return {
      kind: "error",
      message: "Your schedule is temporarily unavailable.",
      retryable: true,
    };
  }
}
