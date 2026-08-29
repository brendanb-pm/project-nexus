"use server";

import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createSchedulingService } from "@/features/scheduling/server";
import { measureServerAction } from "@/server/performance/telemetry";

const PATH = "/schedule";
async function service(operation: string) {
  return createSchedulingService(
    await createProductionPrincipalResolver(),
    operation,
  );
}

export async function createAvailability(form: FormData) {
  return measureServerAction("scheduling.create-availability", async () => {
    await (
      await service("scheduling.create-availability")
    ).createOwnAvailability({
      timezone: form.get("timezone"),
      startsAt: form.get("startsAt"),
      endsAt: form.get("endsAt"),
      status: form.get("status"),
    });
    revalidatePath(PATH);
  });
}

export async function clock(form: FormData) {
  return measureServerAction("scheduling.clock", async () => {
    await (
      await service("scheduling.clock")
    ).clockOwnShift({
      shiftAssignmentId: form.get("shiftAssignmentId"),
      eventType: form.get("eventType"),
      latitude: form.get("latitude"),
      longitude: form.get("longitude"),
      accuracyMeters: form.get("accuracyMeters"),
    });
    revalidatePath(PATH);
  });
}
