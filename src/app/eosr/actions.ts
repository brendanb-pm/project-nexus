"use server";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import { revalidatePath } from "next/cache";

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
  revalidatePath("/schedule");
}
