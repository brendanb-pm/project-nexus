import { AuthorizedDataAccess } from "@/server/request/boundary";
import {
  PermissionDeniedError,
  ResourceNotFoundError,
  StaleUpdateError,
  ValidationError,
} from "@/server/request/errors";
import type {
  ReportingRepository,
  ReportingScope,
} from "@/features/reporting/repository";
import type {
  DraftFamily,
  DraftFinalization,
  SaveDraftInput,
} from "./contracts";
import { draftFamilies } from "./contracts";
import { PostgresReportingDraftRepository } from "./postgres-repository";

const allowedFields: Record<DraftFamily, readonly string[]> = {
  SHIFT_ACTIVITY: [
    "category",
    "narrative",
    "locationContext",
    "actionTaken",
    "followUpRequired",
    "visibility",
  ],
  SECURITY_INCIDENT: [
    "originatingActivityEntryId",
    "classification",
    "severity",
    "narrative",
    "actionsTaken",
    "emergencyServiceInvolvement",
    "externalReportNumber",
    "visibility",
    "participants",
  ],
  SHIFT_CLOSEOUT: [
    "summary",
    "unresolvedIssues",
    "equipmentAccessStatus",
    "followUpItems",
    "unusualConditions",
  ],
};

const participantFields = new Set([
  "type",
  "identityState",
  "displayName",
  "descriptiveIdentifier",
  "involvementSummary",
  "contactPhone",
  "contactEmail",
  "contactInformationStatus",
  "relationshipLabel",
  "agencyName",
  "representativeName",
  "badgeOrEmployeeIdentifier",
  "agencyCaseNumber",
]);

function family(value: unknown): DraftFamily {
  if (
    typeof value !== "string" ||
    !draftFamilies.includes(value as DraftFamily)
  )
    throw new ValidationError({
      family: ["Choose a valid reporting section."],
    });
  return value as DraftFamily;
}

function key(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 100)
    throw new ValidationError({
      [field]: ["Refresh the draft and try again."],
    });
  return value;
}

function revision(value: unknown) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0)
    throw new ValidationError({
      revision: ["Refresh the draft and try again."],
    });
  return number;
}

function payload(value: unknown, draftFamily: DraftFamily) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ValidationError({ draft: ["Draft content is invalid."] });
  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedFields[draftFamily]);
  if (Object.keys(record).some((field) => !allowed.has(field)))
    throw new ValidationError({
      draft: ["Draft content contains unsupported fields."],
    });
  for (const [field, item] of Object.entries(record)) {
    if (field === "participants") {
      if (
        draftFamily !== "SECURITY_INCIDENT" ||
        !Array.isArray(item) ||
        item.some(
          (person) =>
            !person ||
            typeof person !== "object" ||
            Array.isArray(person) ||
            Object.keys(person).some((name) => !participantFields.has(name)) ||
            Object.values(person).some((detail) => typeof detail !== "string"),
        )
      )
        throw new ValidationError({
          participants: ["Participant draft content is invalid."],
        });
    } else if (typeof item !== "string" && typeof item !== "boolean") {
      throw new ValidationError({ [field]: ["Draft content is invalid."] });
    }
  }
  const bytes = new TextEncoder().encode(JSON.stringify(record)).byteLength;
  if (bytes > 65536)
    throw new ValidationError({ draft: ["Keep draft content under 64 KiB."] });
  if (
    draftFamily === "SHIFT_ACTIVITY" &&
    typeof record.narrative === "string" &&
    record.narrative.length > 4000
  )
    throw new ValidationError({
      narrative: ["Keep the narrative under 4,000 characters."],
    });
  if (
    draftFamily === "SECURITY_INCIDENT" &&
    ((typeof record.narrative === "string" && record.narrative.length > 8000) ||
      (typeof record.actionsTaken === "string" &&
        record.actionsTaken.length > 4000))
  )
    throw new ValidationError({
      draft: ["Shorten the incident narrative or actions."],
    });
  return record;
}

export class ReportingDraftService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly reporting: ReportingRepository,
    private readonly repository: PostgresReportingDraftRepository,
  ) {}

  private scope(): ReportingScope {
    const { context } = this.access;
    return { organizationId: context.organizationId, ...context.scope };
  }

  private async authorize(assignmentId: string, draftFamily: DraftFamily) {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Reporting draft");
    const context = await this.reporting.getActivityContext(
      this.scope(),
      assignmentId,
    );
    if (
      !context ||
      context.employeeId !== employeeId ||
      context.assignmentStatus === "cancelled"
    )
      throw new ResourceNotFoundError("Reporting draft");
    const capability =
      draftFamily === "SHIFT_ACTIVITY"
        ? "CREATE_ACTIVITY_ENTRY"
        : draftFamily === "SECURITY_INCIDENT"
          ? "CREATE_INCIDENT"
          : "SUBMIT_HANDOFF";
    this.access.requireHierarchical(capability, {
      ...context,
      visibility: "INTERNAL",
    });
    if (context.organizationId !== this.access.context.organizationId)
      throw new PermissionDeniedError();
    return employeeId;
  }

  async get(assignmentId: string, rawFamily: unknown) {
    const draftFamily = family(rawFamily);
    const employeeId = await this.authorize(assignmentId, draftFamily);
    return this.repository.get(
      this.access.context.organizationId,
      this.access.context.actor.userId,
      employeeId,
      assignmentId,
      draftFamily,
    );
  }

  async save(raw: SaveDraftInput) {
    const assignmentId = key(raw.shiftAssignmentId, "shiftAssignmentId");
    const draftFamily = family(raw.family);
    const employeeId = await this.authorize(assignmentId, draftFamily);
    return this.repository.save(
      {
        organizationId: this.access.context.organizationId,
        ownerUserId: this.access.context.actor.userId,
        ownerEmployeeId: employeeId,
        assignmentId,
        family: draftFamily,
        clientDraftKey: key(raw.clientDraftKey, "clientDraftKey"),
        submissionKey: key(raw.submissionKey, "submissionKey"),
        saveKey: key(raw.saveKey, "saveKey"),
        expectedRevision: revision(raw.expectedRevision),
        payload: payload(raw.payload, draftFamily),
      },
      this.access.auditContext(),
    );
  }

  async discard(assignmentId: string, id: string, rawRevision: unknown) {
    const employeeId = await this.authorize(
      assignmentId,
      (await this.draftForSubmission(assignmentId, id)).draft.family,
    );
    await this.repository.discard(
      this.access.context.organizationId,
      this.access.context.actor.userId,
      employeeId,
      assignmentId,
      id,
      revision(rawRevision),
      this.access.auditContext(),
    );
  }

  async draftForSubmission(assignmentId: string, id: string) {
    const employeeId = this.access.context.scope.employeeId;
    if (!employeeId) throw new ResourceNotFoundError("Reporting draft");
    const draft = await this.repository.getById(
      this.access.context.organizationId,
      this.access.context.actor.userId,
      employeeId,
      assignmentId,
      id,
    );
    if (!draft) throw new ResourceNotFoundError("Reporting draft");
    await this.authorize(assignmentId, draft.family);
    if (
      draft.disposition === "ACTIVE" &&
      new Date(draft.expiresAt) <= new Date()
    )
      throw new StaleUpdateError();
    const finalization: DraftFinalization = {
      id: draft.id,
      organizationId: this.access.context.organizationId,
      ownerUserId: this.access.context.actor.userId,
      ownerEmployeeId: employeeId,
      shiftAssignmentId: assignmentId,
      family: draft.family,
      revision: draft.revision,
      submissionKey: draft.submissionKey,
    };
    return { draft, finalization };
  }
}
