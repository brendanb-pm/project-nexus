import "server-only";

import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import {
  activityEntries,
  auditEvents,
  clientReportDrafts,
  clientReportPublications,
  clients,
  incidentReports,
  posts,
  shiftAssignments,
  shifts,
  sites,
} from "@/server/db/schema";
import type { AuditContext } from "@/server/request/boundary";
import type { ReportingScope } from "@/features/reporting/repository";
import type {
  ClientReportCandidate,
  ClientReportCompositionOption,
  ClientReportDraft,
  ClientReportPublication,
  ClientReportSnapshot,
  ClientReportSource,
  PublishClientReportInput,
} from "./contracts";
import type { ClientPublicationRepository, ValidatedDraft } from "./repository";

function scopeFilter(
  scope: ReportingScope,
  siteIdsColumn:
    typeof clientReportDrafts.siteIds | typeof clientReportPublications.siteIds,
) {
  const tenant = eq(clients.organizationId, scope.organizationId);
  if (scope.organizationWide) return tenant;
  const grants = [];
  if (scope.branchIds.length)
    grants.push(inArray(clients.branchId, [...scope.branchIds]));
  if (scope.clientIds.length)
    grants.push(inArray(clients.id, [...scope.clientIds]));
  if (scope.siteIds.length)
    grants.push(sql`not exists (
      select 1 from jsonb_array_elements_text(${siteIdsColumn}) as report_site(id)
      where report_site.id not in (${sql.join(
        scope.siteIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    )`);
  return and(tenant, grants.length ? or(...grants) : sql`false`);
}

function parseSources(value: unknown): ClientReportSource[] {
  if (!Array.isArray(value)) throw new Error("The report draft is invalid.");
  return value as ClientReportSource[];
}

function draftDto(
  row: typeof clientReportDrafts.$inferSelect,
  latestVersion: number,
): ClientReportDraft {
  return {
    id: row.id,
    clientId: row.clientId,
    siteIds: row.siteIds as string[],
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    executiveSummary: row.executiveSummary,
    completionSummary: row.completionSummary,
    followUps: row.followUps as string[],
    selectedSources: parseSources(row.selectedSources),
    revision: row.revision,
    latestVersion,
  };
}

function publicationDto(
  row: typeof clientReportPublications.$inferSelect,
  isCurrent: boolean,
): ClientReportPublication {
  return {
    id: row.id,
    clientId: row.clientId,
    siteIds: row.siteIds as string[],
    version: row.version,
    isCurrent,
    ...(row.supersedesId ? { supersedesId: row.supersedesId } : {}),
    publishedAt: row.publishedAt.toISOString(),
    snapshot: row.snapshot as ClientReportSnapshot,
  };
}

export class PostgresClientPublicationRepository implements ClientPublicationRepository {
  constructor(private readonly database: NexusDatabase) {}

  async compositionOptions(
    scope: ReportingScope,
  ): Promise<readonly ClientReportCompositionOption[]> {
    const grants = [];
    if (scope.organizationWide) grants.push(sql`true`);
    if (scope.branchIds.length)
      grants.push(inArray(clients.branchId, [...scope.branchIds]));
    if (scope.clientIds.length)
      grants.push(inArray(clients.id, [...scope.clientIds]));
    if (scope.siteIds.length)
      grants.push(inArray(sites.id, [...scope.siteIds]));
    const rows = await this.database
      .select({
        clientId: clients.id,
        clientName: clients.name,
        siteId: sites.id,
        siteName: sites.name,
      })
      .from(sites)
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(
        and(
          eq(clients.organizationId, scope.organizationId),
          eq(sites.active, true),
          grants.length ? or(...grants) : sql`false`,
        ),
      )
      .orderBy(clients.name, sites.name, sites.id)
      .limit(101);
    return rows;
  }

  async candidates(
    scope: ReportingScope,
    clientId: string,
    siteId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<readonly ClientReportCandidate[]> {
    await this.authorizedSites(this.database, scope, clientId, [siteId]);
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const [activities, incidents] = await Promise.all([
      this.database
        .select({
          id: activityEntries.id,
          occurredAt: activityEntries.occurredAt,
          category: activityEntries.category,
        })
        .from(activityEntries)
        .innerJoin(
          shiftAssignments,
          eq(activityEntries.shiftAssignmentId, shiftAssignments.id),
        )
        .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .innerJoin(posts, eq(shifts.postId, posts.id))
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(
          and(
            eq(clients.organizationId, scope.organizationId),
            eq(clients.id, clientId),
            eq(sites.id, siteId),
            eq(activityEntries.visibility, "CLIENT_VISIBLE"),
            inArray(activityEntries.status, [
              "SUBMITTED",
              "ACKNOWLEDGED",
              "APPROVED",
              "AMENDED",
            ]),
            gte(activityEntries.occurredAt, start),
            lt(activityEntries.occurredAt, end),
          ),
        )
        .orderBy(desc(activityEntries.occurredAt), desc(activityEntries.id))
        .limit(25),
      this.database
        .select({
          id: incidentReports.id,
          occurredAt: incidentReports.occurredAt,
          incidentNumber: incidentReports.incidentNumber,
        })
        .from(incidentReports)
        .innerJoin(sites, eq(incidentReports.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(
          and(
            eq(clients.organizationId, scope.organizationId),
            eq(clients.id, clientId),
            eq(sites.id, siteId),
            eq(incidentReports.visibility, "CLIENT_VISIBLE"),
            inArray(incidentReports.status, [
              "SUBMITTED",
              "ACKNOWLEDGED",
              "APPROVED",
              "AMENDED",
            ]),
            gte(incidentReports.occurredAt, start),
            lt(incidentReports.occurredAt, end),
          ),
        )
        .orderBy(desc(incidentReports.occurredAt), desc(incidentReports.id))
        .limit(25),
    ]);
    return [
      ...activities.map((row) => ({
        kind: "ACTIVITY" as const,
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        label: row.category,
      })),
      ...incidents.map((row) => ({
        kind: "INCIDENT" as const,
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        label: row.incidentNumber,
      })),
    ].sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id),
    );
  }

  private async authorizedSites(
    database: NexusDatabase,
    scope: ReportingScope,
    clientId: string,
    siteIds: readonly string[],
  ) {
    const grants = [];
    if (scope.organizationWide) grants.push(sql`true`);
    if (scope.branchIds.length)
      grants.push(inArray(clients.branchId, [...scope.branchIds]));
    if (scope.clientIds.length)
      grants.push(inArray(clients.id, [...scope.clientIds]));
    if (scope.siteIds.length)
      grants.push(inArray(sites.id, [...scope.siteIds]));
    const rows = await database
      .select({
        id: sites.id,
        name: sites.name,
        clientName: clients.name,
      })
      .from(sites)
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(
        and(
          eq(clients.organizationId, scope.organizationId),
          eq(clients.id, clientId),
          inArray(sites.id, [...siteIds]),
          grants.length ? or(...grants) : sql`false`,
        ),
      );
    if (rows.length !== siteIds.length)
      throw new Error(
        "A selected client or site is not in your authorized scope.",
      );
    return rows;
  }

  private async latestVersion(draftId: string) {
    const [row] = await this.database
      .select({ version: clientReportPublications.version })
      .from(clientReportPublications)
      .where(eq(clientReportPublications.draftId, draftId))
      .orderBy(desc(clientReportPublications.version))
      .limit(1);
    return row?.version ?? 0;
  }

  async saveDraft(
    scope: ReportingScope,
    input: ValidatedDraft,
    audit: AuditContext,
  ) {
    await this.authorizedSites(
      this.database,
      scope,
      input.clientId,
      input.siteIds,
    );
    const result = await this.database.transaction(async (tx) => {
      const where = and(
        eq(clientReportDrafts.organizationId, scope.organizationId),
        eq(clientReportDrafts.clientId, input.clientId),
        eq(clientReportDrafts.scopeKey, input.scopeKey),
        eq(clientReportDrafts.periodStart, new Date(input.periodStart)),
        eq(clientReportDrafts.periodEnd, new Date(input.periodEnd)),
      );
      const [current] = await tx
        .select()
        .from(clientReportDrafts)
        .where(where)
        .limit(1);
      let row: typeof clientReportDrafts.$inferSelect | undefined;
      if (current) {
        if (input.expectedRevision !== current.revision)
          throw new Error(
            "This client report draft changed. Refresh and try again.",
          );
        [row] = await tx
          .update(clientReportDrafts)
          .set({
            executiveSummary: input.executiveSummary,
            completionSummary: input.completionSummary,
            followUps: [...input.followUps],
            selectedSources: [...input.selectedSources],
            revision: current.revision + 1,
            updatedByUserId: audit.actorUserId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(clientReportDrafts.id, current.id),
              eq(clientReportDrafts.revision, current.revision),
            ),
          )
          .returning();
      } else {
        if (input.expectedRevision && input.expectedRevision !== 0)
          throw new Error(
            "This client report draft changed. Refresh and try again.",
          );
        [row] = await tx
          .insert(clientReportDrafts)
          .values({
            organizationId: scope.organizationId,
            clientId: input.clientId,
            scopeKey: input.scopeKey,
            siteIds: [...input.siteIds],
            periodStart: new Date(input.periodStart),
            periodEnd: new Date(input.periodEnd),
            executiveSummary: input.executiveSummary,
            completionSummary: input.completionSummary,
            followUps: [...input.followUps],
            selectedSources: [...input.selectedSources],
            createdByUserId: audit.actorUserId,
            updatedByUserId: audit.actorUserId,
          })
          .onConflictDoNothing()
          .returning();
      }
      if (!row)
        throw new Error(
          "This client report draft changed. Refresh and try again.",
        );
      await tx.insert(auditEvents).values({
        organizationId: audit.organizationId,
        actorUserId: audit.actorUserId,
        action: "client-report.draft-saved",
        entityType: "ClientReportDraft",
        entityId: row.id,
        requestId: audit.requestId,
        ...(audit.sessionId ? { sessionId: audit.sessionId } : {}),
        metadata: { revision: row.revision, clientId: row.clientId },
      });
      return row;
    });
    return draftDto(result, await this.latestVersion(result.id));
  }

  async listDrafts(scope: ReportingScope) {
    const rows = await this.database
      .select({ draft: clientReportDrafts })
      .from(clientReportDrafts)
      .innerJoin(clients, eq(clientReportDrafts.clientId, clients.id))
      .where(scopeFilter(scope, clientReportDrafts.siteIds))
      .orderBy(desc(clientReportDrafts.updatedAt), desc(clientReportDrafts.id))
      .limit(25);
    if (!rows.length) return [];
    const versions = await this.database
      .select({
        draftId: clientReportPublications.draftId,
        version: sql<number>`max(${clientReportPublications.version})`,
      })
      .from(clientReportPublications)
      .where(
        inArray(
          clientReportPublications.draftId,
          rows.map((row) => row.draft.id),
        ),
      )
      .groupBy(clientReportPublications.draftId);
    const byDraft = new Map(
      versions.map((row) => [row.draftId, Number(row.version)]),
    );
    return rows.map((row) =>
      draftDto(row.draft, byDraft.get(row.draft.id) ?? 0),
    );
  }

  async draft(scope: ReportingScope, id: string) {
    const [row] = await this.database
      .select({ draft: clientReportDrafts })
      .from(clientReportDrafts)
      .innerJoin(clients, eq(clientReportDrafts.clientId, clients.id))
      .where(
        and(
          scopeFilter(scope, clientReportDrafts.siteIds),
          eq(clientReportDrafts.id, id),
        ),
      )
      .limit(1);
    return row ? draftDto(row.draft, await this.latestVersion(id)) : null;
  }

  private async validatedSnapshot(
    database: NexusDatabase,
    scope: ReportingScope,
    draft: typeof clientReportDrafts.$inferSelect,
  ): Promise<ClientReportSnapshot> {
    const siteIds = draft.siteIds as string[];
    const sitesInScope = await this.authorizedSites(
      database,
      scope,
      draft.clientId,
      siteIds,
    );
    const sources = parseSources(draft.selectedSources);
    const activityIds = sources
      .filter((source) => source.kind === "ACTIVITY")
      .map((source) => source.id);
    const incidentIds = sources
      .filter((source) => source.kind === "INCIDENT")
      .map((source) => source.id);
    const [activities, incidents] = await Promise.all([
      activityIds.length
        ? database
            .select({
              id: activityEntries.id,
              siteId: sites.id,
              occurredAt: activityEntries.occurredAt,
              category: activityEntries.category,
            })
            .from(activityEntries)
            .innerJoin(
              shiftAssignments,
              eq(activityEntries.shiftAssignmentId, shiftAssignments.id),
            )
            .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
            .innerJoin(posts, eq(shifts.postId, posts.id))
            .innerJoin(sites, eq(posts.siteId, sites.id))
            .innerJoin(clients, eq(sites.clientId, clients.id))
            .where(
              and(
                eq(clients.organizationId, scope.organizationId),
                eq(clients.id, draft.clientId),
                inArray(sites.id, siteIds),
                inArray(activityEntries.id, activityIds),
                eq(activityEntries.visibility, "CLIENT_VISIBLE"),
                inArray(activityEntries.status, [
                  "SUBMITTED",
                  "ACKNOWLEDGED",
                  "APPROVED",
                  "AMENDED",
                ]),
                gte(activityEntries.occurredAt, draft.periodStart),
                lt(activityEntries.occurredAt, draft.periodEnd),
              ),
            )
        : Promise.resolve([]),
      incidentIds.length
        ? database
            .select({
              id: incidentReports.id,
              siteId: sites.id,
              occurredAt: incidentReports.occurredAt,
              incidentNumber: incidentReports.incidentNumber,
              classification: incidentReports.classification,
              severity: incidentReports.severity,
            })
            .from(incidentReports)
            .innerJoin(sites, eq(incidentReports.siteId, sites.id))
            .innerJoin(clients, eq(sites.clientId, clients.id))
            .where(
              and(
                eq(clients.organizationId, scope.organizationId),
                eq(clients.id, draft.clientId),
                inArray(sites.id, siteIds),
                inArray(incidentReports.id, incidentIds),
                eq(incidentReports.visibility, "CLIENT_VISIBLE"),
                inArray(incidentReports.status, [
                  "SUBMITTED",
                  "ACKNOWLEDGED",
                  "APPROVED",
                  "AMENDED",
                ]),
                gte(incidentReports.occurredAt, draft.periodStart),
                lt(incidentReports.occurredAt, draft.periodEnd),
              ),
            )
        : Promise.resolve([]),
    ]);
    if (
      activities.length !== activityIds.length ||
      incidents.length !== incidentIds.length
    )
      throw new Error(
        "A selected source is not submitted, client-visible, in period, or in scope.",
      );
    const activityById = new Map(activities.map((row) => [row.id, row]));
    const incidentById = new Map(incidents.map((row) => [row.id, row]));
    return {
      clientId: draft.clientId,
      clientName: sitesInScope[0].clientName,
      sites: sitesInScope
        .map((row) => ({ id: row.id, name: row.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      periodStart: draft.periodStart.toISOString(),
      periodEnd: draft.periodEnd.toISOString(),
      executiveSummary: draft.executiveSummary,
      completionSummary: draft.completionSummary,
      followUps: draft.followUps as string[],
      sources: sources.map((source) => {
        if (source.kind === "ACTIVITY") {
          const row = activityById.get(source.id)!;
          return {
            kind: "ACTIVITY" as const,
            id: row.id,
            siteId: row.siteId,
            occurredAt: row.occurredAt.toISOString(),
            category: row.category,
            clientSummary: source.clientSummary,
          };
        }
        const row = incidentById.get(source.id)!;
        return {
          kind: "INCIDENT" as const,
          id: row.id,
          siteId: row.siteId,
          occurredAt: row.occurredAt.toISOString(),
          incidentNumber: row.incidentNumber,
          classification: row.classification,
          severity: row.severity,
          clientSummary: source.clientSummary,
        };
      }),
    };
  }

  async publish(
    scope: ReportingScope,
    input: PublishClientReportInput,
    audit: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`select id from client_report_drafts
        where id=${input.draftId} and organization_id=${scope.organizationId}
        for update`);
      const [result] = await tx
        .select({ draft: clientReportDrafts })
        .from(clientReportDrafts)
        .innerJoin(clients, eq(clientReportDrafts.clientId, clients.id))
        .where(
          and(
            scopeFilter(scope, clientReportDrafts.siteIds),
            eq(clientReportDrafts.id, input.draftId),
          ),
        )
        .limit(1);
      if (!result)
        throw new Error("Client report draft not found in authorized scope.");
      const draft = result.draft;
      const [replay] = await tx
        .select()
        .from(clientReportPublications)
        .where(
          and(
            eq(clientReportPublications.draftId, draft.id),
            eq(clientReportPublications.confirmationKey, input.confirmationKey),
          ),
        )
        .limit(1);
      if (replay) {
        const [successor] = await tx
          .select({ id: clientReportPublications.id })
          .from(clientReportPublications)
          .where(eq(clientReportPublications.supersedesId, replay.id))
          .limit(1);
        return publicationDto(replay, !successor);
      }
      const [previous] = await tx
        .select()
        .from(clientReportPublications)
        .where(eq(clientReportPublications.draftId, draft.id))
        .orderBy(desc(clientReportPublications.version))
        .limit(1);
      if (
        draft.revision !== input.expectedDraftRevision ||
        (previous?.version ?? 0) !== input.expectedVersion
      )
        throw new Error(
          "This client report changed. Refresh and review before publishing.",
        );
      const snapshot = await this.validatedSnapshot(
        tx as NexusDatabase,
        scope,
        draft,
      );
      const publishedAt = new Date();
      const [row] = await tx
        .insert(clientReportPublications)
        .values({
          draftId: draft.id,
          organizationId: scope.organizationId,
          clientId: draft.clientId,
          siteIds: draft.siteIds,
          periodStart: draft.periodStart,
          periodEnd: draft.periodEnd,
          version: input.expectedVersion + 1,
          ...(previous ? { supersedesId: previous.id } : {}),
          confirmationKey: input.confirmationKey,
          snapshot,
          publishedByUserId: audit.actorUserId,
          publishedAt,
        })
        .returning();
      await tx.insert(auditEvents).values({
        organizationId: audit.organizationId,
        actorUserId: audit.actorUserId,
        action: "client-report.published",
        entityType: "ClientReportPublication",
        entityId: row.id,
        occurredAt: publishedAt,
        requestId: audit.requestId,
        ...(audit.sessionId ? { sessionId: audit.sessionId } : {}),
        metadata: {
          clientId: draft.clientId,
          siteIds: draft.siteIds,
          version: row.version,
          supersedesId: previous?.id ?? null,
          sourceIds: snapshot.sources.map((source) => source.id),
        },
      });
      return publicationDto(row, true);
    });
  }

  async listPublished(scope: ReportingScope) {
    const rows = await this.database
      .select({
        publication: clientReportPublications,
        isCurrent: sql<boolean>`not exists (
          select 1 from client_report_publications successor
          where successor.supersedes_id = ${clientReportPublications.id}
        )`,
      })
      .from(clientReportPublications)
      .innerJoin(clients, eq(clientReportPublications.clientId, clients.id))
      .where(
        and(
          eq(clientReportPublications.organizationId, scope.organizationId),
          scopeFilter(scope, clientReportPublications.siteIds),
        ),
      )
      .orderBy(
        desc(clientReportPublications.publishedAt),
        desc(clientReportPublications.id),
      )
      .limit(25);
    return rows.map((row) => publicationDto(row.publication, row.isCurrent));
  }

  async publication(scope: ReportingScope, id: string) {
    const [row] = await this.database
      .select({
        publication: clientReportPublications,
        isCurrent: sql<boolean>`not exists (
          select 1 from client_report_publications successor
          where successor.supersedes_id = ${clientReportPublications.id}
        )`,
      })
      .from(clientReportPublications)
      .innerJoin(clients, eq(clientReportPublications.clientId, clients.id))
      .where(
        and(
          eq(clientReportPublications.organizationId, scope.organizationId),
          scopeFilter(scope, clientReportPublications.siteIds),
          eq(clientReportPublications.id, id),
        ),
      )
      .limit(1);
    return row ? publicationDto(row.publication, row.isCurrent) : null;
  }
}
