"use server";

import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createReportingDraftService } from "@/features/reporting-drafts/server";
import { createReportingService } from "@/features/reporting/server";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import {
  draftFamilies,
  type DraftFamily,
} from "@/features/reporting-drafts/contracts";
import {
  AuthenticationRequiredError,
  InvariantViolationError,
  PermissionDeniedError,
  ResourceNotFoundError,
  StaleUpdateError,
  ValidationError,
} from "@/server/request/errors";

function denied(error: unknown) {
  return (
    error instanceof AuthenticationRequiredError ||
    error instanceof PermissionDeniedError ||
    error instanceof ResourceNotFoundError ||
    error instanceof InvariantViolationError
  );
}

export async function recoverReportingDraft(
  assignmentId: string,
  family: DraftFamily,
) {
  try {
    if (!draftFamilies.includes(family))
      return { kind: "inaccessible" as const };
    const service = await createReportingDraftService(
      await createProductionPrincipalResolver(),
      "reporting-draft.recover",
    );
    const draft = await service.get(assignmentId, family);
    return draft
      ? { kind: "found" as const, draft }
      : { kind: "empty" as const };
  } catch (error) {
    if (denied(error)) return { kind: "inaccessible" as const };
    throw error;
  }
}

export async function saveReportingDraft(form: FormData) {
  try {
    const service = await createReportingDraftService(
      await createProductionPrincipalResolver(),
      "reporting-draft.save",
    );
    const payload = JSON.parse(String(form.get("payload") ?? "{}")) as unknown;
    const draft = await service.save({
      shiftAssignmentId: form.get("shiftAssignmentId"),
      family: form.get("family"),
      clientDraftKey: form.get("clientDraftKey"),
      submissionKey: form.get("submissionKey"),
      saveKey: form.get("saveKey"),
      expectedRevision: form.get("expectedRevision"),
      payload,
    });
    return { kind: "saved" as const, draft };
  } catch (error) {
    if (error instanceof StaleUpdateError) return { kind: "conflict" as const };
    if (error instanceof ValidationError)
      return {
        kind: "validation-error" as const,
        fieldErrors: error.fieldErrors,
      };
    if (denied(error)) return { kind: "inaccessible" as const };
    throw error;
  }
}

export async function discardReportingDraft(
  assignmentId: string,
  id: string,
  expectedRevision: number,
) {
  try {
    const service = await createReportingDraftService(
      await createProductionPrincipalResolver(),
      "reporting-draft.discard",
    );
    await service.discard(assignmentId, id, expectedRevision);
    return { kind: "discarded" as const };
  } catch (error) {
    if (error instanceof StaleUpdateError) return { kind: "conflict" as const };
    if (denied(error)) return { kind: "inaccessible" as const };
    throw error;
  }
}

export async function submitReportingDraft(
  assignmentId: string,
  id: string,
  expectedRevision: number,
) {
  try {
    const resolver = await createProductionPrincipalResolver();
    const service = await createReportingDraftService(
      resolver,
      "reporting-draft.submit",
    );
    const { draft, finalization } = await service.draftForSubmission(
      assignmentId,
      id,
    );
    if (draft.disposition === "SUBMITTED" && draft.canonicalRecordId)
      return {
        kind: "already-submitted" as const,
        family: draft.family,
        canonicalRecordId: draft.canonicalRecordId,
      };
    if (draft.disposition !== "ACTIVE" || draft.revision !== expectedRevision)
      return { kind: "conflict" as const };
    const input: Record<string, unknown> = {
      ...draft.payload,
      shiftAssignmentId: assignmentId,
      submissionKey: draft.submissionKey,
    };
    if (draft.family === "SHIFT_ACTIVITY") {
      const result = await (
        await createReportingService(
          resolver,
          "reporting-draft.submit-activity",
        )
      ).createActivity(
        {
          category: input.category,
          narrative: input.narrative,
          locationContext: input.locationContext,
          actionTaken: input.actionTaken,
          followUpRequired: input.followUpRequired,
          visibility: input.visibility,
          shiftAssignmentId: assignmentId,
          submissionKey: draft.submissionKey,
        },
        finalization,
      );
      revalidatePath("/reporting");
      return {
        kind: "submitted" as const,
        family: draft.family,
        record: result,
      };
    }
    if (draft.family === "SECURITY_INCIDENT") {
      const result = await (
        await createReportingService(
          resolver,
          "reporting-draft.submit-incident",
        )
      ).createIncident(
        {
          originatingActivityEntryId: input.originatingActivityEntryId,
          classification: input.classification,
          severity: input.severity,
          narrative: input.narrative,
          actionsTaken: input.actionsTaken,
          emergencyServiceInvolvement: input.emergencyServiceInvolvement,
          externalReportNumber: input.externalReportNumber,
          visibility: input.visibility,
          participants: input.participants,
          shiftAssignmentId: assignmentId,
          submissionKey: draft.submissionKey,
        },
        finalization,
      );
      revalidatePath("/reporting");
      return {
        kind: "submitted" as const,
        family: draft.family,
        record: result,
      };
    }
    const result = await (
      await createEndOfShiftReportService(
        resolver,
        "reporting-draft.submit-closeout",
      )
    ).submit(
      {
        summary: input.summary,
        unresolvedIssues: input.unresolvedIssues,
        equipmentAccessStatus: input.equipmentAccessStatus,
        followUpItems: input.followUpItems,
        unusualConditions: input.unusualConditions,
        shiftAssignmentId: assignmentId,
        submissionKey: draft.submissionKey,
      },
      finalization,
    );
    revalidatePath("/reporting");
    revalidatePath("/eosr");
    return { kind: "submitted" as const, family: draft.family, record: result };
  } catch (error) {
    if (error instanceof StaleUpdateError) return { kind: "conflict" as const };
    if (error instanceof ValidationError)
      return {
        kind: "validation-error" as const,
        fieldErrors: error.fieldErrors,
      };
    if (denied(error)) return { kind: "inaccessible" as const };
    throw error;
  }
}
