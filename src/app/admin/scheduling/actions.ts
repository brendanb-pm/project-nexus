"use server";

import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createSchedulingService } from "@/features/scheduling/server";
import { measureServerAction } from "@/server/performance/telemetry";

const PATH = "/admin/scheduling";
async function service(operation: string) {
  return createSchedulingService(
    await createProductionPrincipalResolver(),
    operation,
  );
}

export async function createShift(form: FormData) {
  return measureServerAction("scheduling.create-shift", async () => {
    const [postId, timezone] = String(form.get("post") ?? "").split("|");
    await (
      await service("scheduling.create-shift")
    ).createShift({
      postId,
      timezone,
      scheduledStart: form.get("scheduledStart"),
      scheduledEnd: form.get("scheduledEnd"),
      staffingRequirement: form.get("staffingRequirement"),
      status: form.get("status"),
    });
    revalidatePath(PATH);
  });
}

export async function assignEmployee(form: FormData) {
  return measureServerAction("scheduling.assign-employee", async () => {
    await (
      await service("scheduling.assign-employee")
    ).assignEmployee({
      shiftId: form.get("shiftId"),
      employeeId: form.get("employeeId"),
    });
    revalidatePath(PATH);
  });
}
