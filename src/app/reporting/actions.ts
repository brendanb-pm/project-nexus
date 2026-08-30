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

export async function createIncident(form: FormData) {
  return measureServerAction("reporting.create-incident", async () => {
    const incident = await (
      await createReportingService(
        await createProductionPrincipalResolver(),
        "reporting.create-incident",
      )
    ).createIncident({
      shiftAssignmentId: form.get("shiftAssignmentId"),
      originatingActivityEntryId: form.get("originatingActivityEntryId"),
      classification: form.get("classification"),
      severity: form.get("severity"),
      occurredAt: form.get("occurredAt"),
      narrative: form.get("narrative"),
      actionsTaken: form.get("actionsTaken"),
      emergencyServiceInvolvement: form.get("emergencyServiceInvolvement"),
      externalReportNumber: form.get("externalReportNumber"),
      visibility: form.get("visibility"),
      submissionKey: form.get("submissionKey"),
    });
    revalidatePath("/reporting");
    return incident;
  });
}

export async function createHandoff(form: FormData) {
  return measureServerAction("reporting.create-handoff", async () => {
    const handoff = await (
      await createReportingService(
        await createProductionPrincipalResolver(),
        "reporting.create-handoff",
      )
    ).createHandoff({
      shiftAssignmentId: form.get("shiftAssignmentId"),
      unresolvedIssues: form.get("unresolvedIssues"),
      equipmentKeyStatus: form.get("equipmentKeyStatus"),
      followUpItems: form.get("followUpItems"),
      visibility: form.get("visibility"),
      submissionKey: form.get("submissionKey"),
    });
    revalidatePath("/reporting");
    return handoff;
  });
}
