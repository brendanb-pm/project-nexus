"use server";
import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createReportingService } from "@/features/reporting/server";
import { measureServerAction } from "@/server/performance/telemetry";
export async function createActivity(form: FormData) {
  return measureServerAction("reporting.create-activity", async () => {
    const entry = await (
      await createReportingService(
        await createProductionPrincipalResolver(),
        "reporting.create-activity",
      )
    ).createActivity({
      shiftAssignmentId: form.get("shiftAssignmentId"),
      category: form.get("category"),
      occurredAt: form.get("occurredAt"),
      locationContext: form.get("locationContext"),
      narrative: form.get("narrative"),
      actionTaken: form.get("actionTaken"),
      followUpRequired: form.get("followUpRequired"),
      visibility: form.get("visibility"),
      submissionKey: form.get("submissionKey"),
    });
    revalidatePath("/reporting");
    return entry;
  });
}
