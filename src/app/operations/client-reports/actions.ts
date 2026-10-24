"use server";

import { revalidatePath } from "next/cache";
import { createClientPublicationService } from "@/features/client-publication/server";
import type { ClientReportSource } from "@/features/client-publication/contracts";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";

export type ClientReportActionState = {
  kind: "idle" | "saved" | "published" | "rejected";
  message: string;
};

function safeMessage(error: unknown) {
  if (
    error instanceof AuthenticationRequiredError ||
    error instanceof PermissionDeniedError
  )
    return "You cannot manage client reports in this authorized scope.";
  if (
    error instanceof Error &&
    [
      "Choose ",
      "Executive summary must",
      "Completion summary must",
      "Follow-up must",
      "Client-safe source summary must",
      "This client report",
      "A selected client or site",
      "A selected source",
      "Confirm the current report",
      "This report exceeds",
      "Select each canonical source",
    ].some((prefix) => error.message.startsWith(prefix))
  )
    return error.message;
  return "The report was not changed. Refresh and try again.";
}

export async function saveClientReportDraft(
  _prior: ClientReportActionState,
  form: FormData,
): Promise<ClientReportActionState> {
  try {
    const sources: ClientReportSource[] = form.getAll("source").map((value) => {
      const [kind, id] = String(value).split(":");
      return {
        kind: kind as ClientReportSource["kind"],
        id,
        clientSummary: String(form.get(`summary:${kind}:${id}`) ?? ""),
      };
    });
    const service = await createClientPublicationService(
      "client-report.draft-save",
    );
    const draft = await service.saveDraft({
      clientId: String(form.get("clientId") ?? ""),
      siteIds: [String(form.get("siteId") ?? "")],
      periodStart: String(form.get("periodStart") ?? ""),
      periodEnd: String(form.get("periodEnd") ?? ""),
      executiveSummary: String(form.get("executiveSummary") ?? ""),
      completionSummary: String(form.get("completionSummary") ?? ""),
      followUps: String(form.get("followUps") ?? "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      selectedSources: sources,
      expectedRevision: Number(form.get("expectedRevision") ?? 0),
    });
    revalidatePath("/operations/client-reports");
    return {
      kind: "saved",
      message: `Draft saved at revision ${draft.revision}. Review it below before publishing.`,
    };
  } catch (error) {
    return { kind: "rejected", message: safeMessage(error) };
  }
}

export async function publishClientReport(
  _prior: ClientReportActionState,
  form: FormData,
): Promise<ClientReportActionState> {
  try {
    const service = await createClientPublicationService(
      "client-report.publish",
    );
    const publication = await service.publish({
      draftId: String(form.get("draftId") ?? ""),
      expectedDraftRevision: Number(form.get("expectedDraftRevision") ?? -1),
      expectedVersion: Number(form.get("expectedVersion") ?? -1),
      confirmationKey: String(form.get("confirmationKey") ?? ""),
      confirmed: form.get("confirmed") === "on",
    });
    revalidatePath("/operations/client-reports");
    revalidatePath("/portal");
    return {
      kind: "published",
      message: `Published immutable version ${publication.version}. Client access is now available.`,
    };
  } catch (error) {
    return { kind: "rejected", message: safeMessage(error) };
  }
}
