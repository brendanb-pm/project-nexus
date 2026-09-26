import { createHash } from "node:crypto";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { PermissionDeniedError } from "@/server/request/errors";
import type { ReportingScope } from "@/features/reporting/repository";
import type {
  ClientReportDraftInput,
  PublishClientReportInput,
} from "./contracts";
import type { ClientPublicationRepository } from "./repository";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validText(value: string, name: string, min: number, max: number) {
  const result = value.trim();
  if (result.length < min || result.length > max)
    throw new Error(`${name} must contain ${min}–${max} characters.`);
  return result;
}

export function validateDraft(input: ClientReportDraftInput) {
  if (!uuid.test(input.clientId))
    throw new Error("Choose an authorized client.");
  const siteIds = [...new Set(input.siteIds)].sort();
  if (
    siteIds.length !== input.siteIds.length ||
    siteIds.length < 1 ||
    siteIds.length > 20 ||
    siteIds.some((id) => !uuid.test(id))
  )
    throw new Error("Choose 1–20 distinct authorized sites.");
  const start = new Date(input.periodStart);
  const end = new Date(input.periodEnd);
  if (
    !Number.isFinite(start.valueOf()) ||
    !Number.isFinite(end.valueOf()) ||
    end.valueOf() <= start.valueOf() ||
    end.valueOf() - start.valueOf() > 31 * 24 * 60 * 60 * 1000
  )
    throw new Error("Choose a reporting period of up to 31 days.");
  if (input.followUps.length > 20 || input.selectedSources.length > 50)
    throw new Error("This report exceeds the bounded content limit.");
  const keys = input.selectedSources.map(
    (source) => `${source.kind}:${source.id}`,
  );
  if (new Set(keys).size !== keys.length)
    throw new Error("Select each canonical source only once.");
  const selectedSources = input.selectedSources.map((source) => {
    if (
      !["ACTIVITY", "INCIDENT"].includes(source.kind) ||
      !uuid.test(source.id)
    )
      throw new Error("Choose a valid canonical source.");
    return {
      kind: source.kind,
      id: source.id,
      clientSummary: validText(
        source.clientSummary,
        "Client-safe source summary",
        3,
        1000,
      ),
    };
  });
  if (
    input.expectedRevision !== undefined &&
    (!Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0)
  )
    throw new Error("The draft revision is invalid. Refresh and try again.");
  return {
    ...input,
    siteIds,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    executiveSummary: validText(
      input.executiveSummary,
      "Executive summary",
      3,
      5000,
    ),
    completionSummary: validText(
      input.completionSummary,
      "Completion summary",
      3,
      2000,
    ),
    followUps: input.followUps.map((item) =>
      validText(item, "Follow-up", 1, 500),
    ),
    selectedSources,
    scopeKey: createHash("sha256").update(siteIds.join(",")).digest("hex"),
  };
}

export class ClientPublicationService {
  constructor(
    private readonly access: AuthorizedDataAccess,
    private readonly repository: ClientPublicationRepository,
  ) {}

  private scope(): ReportingScope {
    return {
      organizationId: this.access.context.organizationId,
      ...this.access.context.scope,
    };
  }

  private requirePublisher() {
    this.access.requireOrganization("PUBLISH_CLIENT_REPORTS");
    if (
      !this.access.context.actor.roles.some(
        (role) => role === "OPERATIONS_MANAGER" || role === "ADMIN",
      )
    )
      throw new PermissionDeniedError();
  }

  async saveDraft(input: ClientReportDraftInput) {
    this.requirePublisher();
    return this.repository.saveDraft(
      this.scope(),
      validateDraft(input),
      this.access.auditContext(),
    );
  }

  async compositionOptions() {
    this.requirePublisher();
    return this.repository.compositionOptions(this.scope());
  }

  async candidates(
    clientId: string,
    siteId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    this.requirePublisher();
    if (!uuid.test(clientId) || !uuid.test(siteId))
      throw new Error("Choose an authorized client and site.");
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (
      !Number.isFinite(start.valueOf()) ||
      !Number.isFinite(end.valueOf()) ||
      end <= start ||
      end.valueOf() - start.valueOf() > 31 * 24 * 60 * 60 * 1000
    )
      throw new Error("Choose a reporting period of up to 31 days.");
    return this.repository.candidates(
      this.scope(),
      clientId,
      siteId,
      start.toISOString(),
      end.toISOString(),
    );
  }

  async listDrafts() {
    this.requirePublisher();
    return this.repository.listDrafts(this.scope());
  }

  async draft(id: string) {
    this.requirePublisher();
    if (!uuid.test(id)) throw new Error("Report draft not found.");
    return this.repository.draft(this.scope(), id);
  }

  async publish(input: PublishClientReportInput) {
    this.requirePublisher();
    if (
      !input.confirmed ||
      !uuid.test(input.draftId) ||
      !uuid.test(input.confirmationKey) ||
      !Number.isSafeInteger(input.expectedDraftRevision) ||
      input.expectedDraftRevision < 0 ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0
    )
      throw new Error("Confirm the current report version before publishing.");
    return this.repository.publish(
      this.scope(),
      input,
      this.access.auditContext(),
    );
  }

  async listPublished() {
    this.access.requireAny(["VIEW_CLIENT_REPORTS", "PUBLISH_CLIENT_REPORTS"], {
      organizationId: this.access.context.organizationId,
    });
    return this.repository.listPublished(this.scope());
  }

  async publication(id: string) {
    this.access.requireAny(["VIEW_CLIENT_REPORTS", "PUBLISH_CLIENT_REPORTS"], {
      organizationId: this.access.context.organizationId,
    });
    if (!uuid.test(id)) throw new Error("Published report not found.");
    return this.repository.publication(this.scope(), id);
  }
}
