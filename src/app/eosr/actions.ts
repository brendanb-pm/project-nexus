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
