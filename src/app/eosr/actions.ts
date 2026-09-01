"use server";
import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createEndOfShiftReportService } from "@/features/eosr/server";
export async function submitEndOfShiftReport(form: FormData) {
  const result = await (
    await createEndOfShiftReportService(
      await createProductionPrincipalResolver(),
      "eosr.submit",
    )
  ).submit({
    shiftAssignmentId: form.get("shiftAssignmentId"),
    summary: form.get("summary"),
    unresolvedIssues: form.get("unresolvedIssues"),
    equipmentAccessStatus: form.get("equipmentAccessStatus"),
    followUpItems: form.get("followUpItems"),
    unusualConditions: form.get("unusualConditions"),
    submissionKey: form.get("submissionKey"),
  });
  revalidatePath("/eosr");
  revalidatePath("/schedule");
  return result;
}

export async function setPassdownDismissal(form: FormData) {
  const id = form.get("id");
  const dismissed = form.get("dismissed");
  if (typeof id !== "string" || !id) throw new Error("Passdown is required.");
  await (
    await createEndOfShiftReportService(
      await createProductionPrincipalResolver(),
      "eosr.passdown-dismissal",
    )
  ).dismissPassdown(id, dismissed === "true");
  revalidatePath("/eosr");
}
