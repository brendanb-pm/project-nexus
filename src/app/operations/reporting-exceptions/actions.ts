"use server";

import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createReportingExceptionService } from "@/features/reporting-exceptions/server";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";

export type ReportingExceptionActionResult =
  | { kind: "confirmed"; message: string }
  | { kind: "rejected"; message: string };

export async function transitionReportingException(
  form: FormData,
): Promise<ReportingExceptionActionResult> {
  try {
    await (
      await createReportingExceptionService(
        await createProductionPrincipalResolver(),
        "reporting-exceptions.transition",
      )
    ).transition({
      exceptionId: String(form.get("exceptionId") ?? ""),
      nextState: String(form.get("nextState") ?? "") as never,
      reason: String(form.get("reason") ?? ""),
      expectedRevision: Number(form.get("expectedRevision")),
      ...(form.get("assigneeUserId")
        ? { assigneeUserId: String(form.get("assigneeUserId")) }
        : {}),
    });
    revalidatePath("/operations/reporting-exceptions");
    revalidatePath("/operations");
    revalidatePath("/reporting");
    return { kind: "confirmed", message: "Reporting exception updated." };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError ||
      error instanceof ResourceNotFoundError
    )
      return {
        kind: "rejected",
        message:
          "This reporting exception is not available in your authorized scope.",
      };
    return {
      kind: "rejected",
      message:
        "The reporting exception was not changed. Refresh and try again.",
    };
  }
}
