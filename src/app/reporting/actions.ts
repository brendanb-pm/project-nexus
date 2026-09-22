"use server";
import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createReportingService } from "@/features/reporting/server";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import { measureServerAction } from "@/server/performance/telemetry";
import {
  AuthenticationRequiredError,
  InvariantViolationError,
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
} from "@/server/request/errors";
import type { CreateActivityResult } from "@/features/reporting/contracts";
export async function createActivity(
  form: FormData,
): Promise<CreateActivityResult> {
  return measureServerAction("reporting.create-activity", async () => {
    try {
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
      return { kind: "confirmed", entry };
    } catch (error) {
      if (error instanceof ValidationError)
        return { kind: "validation-error", fieldErrors: error.fieldErrors };
      if (
        error instanceof AuthenticationRequiredError ||
        error instanceof PermissionDeniedError ||
        error instanceof ResourceNotFoundError ||
        error instanceof InvariantViolationError
      )
        return {
          kind: "rejected",
          message:
            "This activity could not be recorded for the current assignment. Refresh the Shift Report and try again.",
        };
      throw error;
    }
  });
}

/** The canonical EOSR transaction, exposed only as the final Shift Report section. */
export async function submitShiftCloseout(form: FormData) {
  return measureServerAction("reporting.submit-shift-closeout", async () => {
    try {
      const report = await (
        await createEndOfShiftReportService(
          await createProductionPrincipalResolver(),
          "reporting.submit-shift-closeout",
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
      revalidatePath("/reporting");
      revalidatePath("/eosr");
      revalidatePath("/schedule");
      revalidatePath("/");
      return { kind: "confirmed" as const, report };
    } catch (error) {
      if (error instanceof ValidationError)
        return { kind: "validation-error" as const, fieldErrors: error.fieldErrors };
      if (
        error instanceof AuthenticationRequiredError ||
        error instanceof PermissionDeniedError ||
        error instanceof ResourceNotFoundError ||
        error instanceof InvariantViolationError
      )
        return {
          kind: "rejected" as const,
          message:
            "This closeout could not be submitted for the current assignment. Refresh the Shift Report and try again.",
        };
      throw error;
    }
  });
}

export async function createIncident(form: FormData) {
  return measureServerAction("reporting.create-incident", async () => {
    let participants: unknown = [];
    try {
      participants = JSON.parse(String(form.get("participants") || "[]"));
    } catch {
      participants = [];
    }
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
      participants,
      submissionKey: form.get("submissionKey"),
    });
    revalidatePath("/reporting");
    return incident;
  });
}

export async function acknowledgeOperationalRecord(form: FormData) {
  return measureServerAction(
    "reporting.acknowledge-operational-record",
    async () => {
      const service = await createReportingService(
        await createProductionPrincipalResolver(),
        "reporting.acknowledge-operational-record",
      );
      const record = await service.acknowledgeOperationalRecord({
        entityType: form.get("entityType"),
        recordId: form.get("recordId"),
      });
      revalidatePath("/reporting");
      revalidatePath("/operations");
      return record;
    },
  );
}

export async function amendOperationalRecord(form: FormData) {
  return measureServerAction("reporting.amend-operational-record", async () => {
    const service = await createReportingService(
      await createProductionPrincipalResolver(),
      "reporting.amend-operational-record",
    );
    const record = await service.amendOperationalRecord({
      entityType: form.get("entityType"),
      recordId: form.get("recordId"),
      expectedRevision: form.get("expectedRevision"),
      reason: form.get("reason"),
      amendment: JSON.parse(String(form.get("amendment") || "{}")) as Record<
        string,
        unknown
      >,
      idempotencyKey: form.get("idempotencyKey"),
    });
    revalidatePath("/reporting");
    revalidatePath("/operations");
    return record;
  });
}

export async function getOperationalRecord(form: FormData) {
  const service = await createReportingService(
    await createProductionPrincipalResolver(),
    "reporting.get-operational-record",
  );
  const entityType = String(form.get("entityType"));
  if (!["ActivityEntry", "IncidentReport", "Handoff"].includes(entityType))
    throw new Error("Invalid operational record type.");
  return service.getReviewRecord(
    entityType as "ActivityEntry" | "IncidentReport" | "Handoff",
    String(form.get("recordId")),
  );
}
