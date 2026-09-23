import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import type { RecordStatus, VisibilityClassification } from "@/domain/model";
import {
  activityEntries,
  clients,
  endOfShiftReports,
  incidentReports,
  posts,
  reportingExceptions,
  shiftAssignments,
  shifts,
  sites,
} from "@/server/db/schema";
import type { ReportingScope } from "@/features/reporting/repository";
import type {
  ReportHubFilters,
  ReportHubRow,
  ReportHubSite,
} from "./contracts";
import type { ReportHubPage, ReportingHubRepository } from "./repository";

type Cursor = { timestamp: Date; id: string };
const SITE_OPTION_LIMIT = 200;

const recordStatuses = new Set<RecordStatus>([
  "DRAFT",
  "SUBMITTED",
  "ACKNOWLEDGED",
  "APPROVED",
  "AMENDED",
]);
const exceptionStatuses = new Set([
  "OPEN",
  "CORRECTION_REQUESTED",
  "CORRECTED_PENDING_REVIEW",
  "RESOLVED",
  "ESCALATED",
  "WAIVED",
]);

function scopePredicate(scope: ReportingScope) {
  const tenant = eq(clients.organizationId, scope.organizationId);
  if (scope.organizationWide) return tenant;
  const allowed = [];
  if (scope.branchIds.length)
    allowed.push(inArray(clients.branchId, [...scope.branchIds]));
  if (scope.clientIds.length)
    allowed.push(inArray(clients.id, [...scope.clientIds]));
  if (scope.siteIds.length) allowed.push(inArray(sites.id, [...scope.siteIds]));
  return and(tenant, allowed.length ? or(...allowed) : sql`false`);
}

function parseCursor(value?: string): Cursor | undefined {
  if (!value) return undefined;
  const separator = value.lastIndexOf("|");
  if (separator < 1) return undefined;
  const timestamp = new Date(value.slice(0, separator));
  const id = value.slice(separator + 1);
  return Number.isNaN(timestamp.valueOf()) || !/^[0-9a-f-]{36}$/i.test(id)
    ? undefined
    : { timestamp, id };
}

function cursorPredicate(
  column: typeof activityEntries.occurredAt,
  cursor?: Cursor,
) {
  return cursor
    ? or(
        lt(column, cursor.timestamp),
        and(eq(column, cursor.timestamp), lt(activityEntries.id, cursor.id)),
      )
    : undefined;
}

function summary(value: unknown, fallback: string) {
  if (value && typeof value === "object") {
    const narrative = (value as Record<string, unknown>).narrative;
    if (typeof narrative === "string" && narrative.trim()) return narrative;
  }
  return fallback;
}

function sorted(rows: readonly ReportHubRow[]) {
  return [...rows].sort(
    (a, b) =>
      b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id),
  );
}

export class PostgresReportingHubRepository implements ReportingHubRepository {
  constructor(private readonly database: NexusDatabase) {}

  async list(
    scope: ReportingScope,
    filters: ReportHubFilters,
    window: { startsAt: string; endsAt: string },
    visibility: readonly VisibilityClassification[],
    limit: number,
  ): Promise<ReportHubPage> {
    const startsAt = new Date(window.startsAt);
    const endsAt = new Date(window.endsAt);
    const cursor = parseCursor(filters.cursor);
    const siteFilter = filters.siteId
      ? eq(sites.id, filters.siteId)
      : undefined;
    const recordStatus =
      filters.status && recordStatuses.has(filters.status as RecordStatus)
        ? (filters.status as RecordStatus)
        : undefined;
    const common = [scopePredicate(scope), siteFilter].filter(Boolean);
    const fetchLimit = limit + 1;

    const sitePromise = this.database
      .select({ id: sites.id, name: sites.name })
      .from(sites)
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(scopePredicate(scope))
      .orderBy(asc(sites.name), asc(sites.id))
      .limit(SITE_OPTION_LIMIT + 1)
      .then((rows): ReportHubSite[] => rows);

    const activities =
      !filters.family || filters.family === "activity"
        ? this.database
            .select({
              id: activityEntries.id,
              siteId: sites.id,
              siteName: sites.name,
              postName: posts.name,
              timestamp: activityEntries.occurredAt,
              status: activityEntries.status,
              description: activityEntries.description,
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
                ...common,
                inArray(activityEntries.visibility, [...visibility]),
                gte(activityEntries.occurredAt, startsAt),
                lte(activityEntries.occurredAt, endsAt),
                filters.status
                  ? recordStatus
                    ? eq(activityEntries.status, recordStatus)
                    : sql`false`
                  : undefined,
                cursorPredicate(activityEntries.occurredAt, cursor),
              ),
            )
            .orderBy(desc(activityEntries.occurredAt), desc(activityEntries.id))
            .limit(fetchLimit)
            .then((rows): ReportHubRow[] =>
              rows.map((row) => ({
                id: row.id,
                family: "activity",
                familyLabel: "Activity Entry",
                siteId: row.siteId,
                siteName: row.siteName,
                postName: row.postName,
                timestamp: row.timestamp.toISOString(),
                status: row.status,
                summary: summary(row.description, "Activity entry"),
                href: `/operations/records/activity/${row.id}`,
              })),
            )
        : Promise.resolve([]);

    const incidents =
      !filters.family || filters.family === "incident"
        ? this.database
            .select({
              id: incidentReports.id,
              siteId: sites.id,
              siteName: sites.name,
              postName: posts.name,
              timestamp: incidentReports.occurredAt,
              status: incidentReports.status,
              summary: incidentReports.narrative,
            })
            .from(incidentReports)
            .leftJoin(
              shiftAssignments,
              eq(incidentReports.shiftAssignmentId, shiftAssignments.id),
            )
            .leftJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
            .leftJoin(posts, eq(shifts.postId, posts.id))
            .innerJoin(sites, eq(incidentReports.siteId, sites.id))
            .innerJoin(clients, eq(sites.clientId, clients.id))
            .where(
              and(
                ...common,
                inArray(incidentReports.visibility, [...visibility]),
                gte(incidentReports.occurredAt, startsAt),
                lte(incidentReports.occurredAt, endsAt),
                filters.status
                  ? recordStatus
                    ? eq(incidentReports.status, recordStatus)
                    : sql`false`
                  : undefined,
                cursor
                  ? or(
                      lt(incidentReports.occurredAt, cursor.timestamp),
                      and(
                        eq(incidentReports.occurredAt, cursor.timestamp),
                        lt(incidentReports.id, cursor.id),
                      ),
                    )
                  : undefined,
              ),
            )
            .orderBy(desc(incidentReports.occurredAt), desc(incidentReports.id))
            .limit(fetchLimit)
            .then((rows): ReportHubRow[] =>
              rows.map((row) => ({
                id: row.id,
                family: "incident",
                familyLabel: "Security Incident Report",
                siteId: row.siteId,
                siteName: row.siteName,
                postName: row.postName ?? "Site-wide",
                timestamp: row.timestamp.toISOString(),
                status: row.status,
                summary: row.summary,
                href: `/operations/records/incident/${row.id}`,
              })),
            )
        : Promise.resolve([]);

    const eosrs =
      !filters.family || filters.family === "eosr"
        ? this.database
            .select({
              id: endOfShiftReports.id,
              siteId: sites.id,
              siteName: sites.name,
              postName: posts.name,
              timestamp: endOfShiftReports.submittedAt,
              acknowledgedAt: endOfShiftReports.acknowledgedAt,
              summary: endOfShiftReports.summary,
            })
            .from(endOfShiftReports)
            .innerJoin(
              shiftAssignments,
              eq(endOfShiftReports.shiftAssignmentId, shiftAssignments.id),
            )
            .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
            .innerJoin(posts, eq(shifts.postId, posts.id))
            .innerJoin(sites, eq(posts.siteId, sites.id))
            .innerJoin(clients, eq(sites.clientId, clients.id))
            .where(
              and(
                ...common,
                gte(endOfShiftReports.submittedAt, startsAt),
                lte(endOfShiftReports.submittedAt, endsAt),
                filters.status === "ACKNOWLEDGED"
                  ? sql`${endOfShiftReports.acknowledgedAt} is not null`
                  : filters.status === "SUBMITTED"
                    ? sql`${endOfShiftReports.acknowledgedAt} is null`
                    : filters.status
                      ? sql`false`
                      : undefined,
                cursor
                  ? or(
                      lt(endOfShiftReports.submittedAt, cursor.timestamp),
                      and(
                        eq(endOfShiftReports.submittedAt, cursor.timestamp),
                        lt(endOfShiftReports.id, cursor.id),
                      ),
                    )
                  : undefined,
              ),
            )
            .orderBy(
              desc(endOfShiftReports.submittedAt),
              desc(endOfShiftReports.id),
            )
            .limit(fetchLimit)
            .then((rows): ReportHubRow[] =>
              rows.map((row) => ({
                id: row.id,
                family: "eosr",
                familyLabel: "EOSR / Shift Closeout",
                siteId: row.siteId,
                siteName: row.siteName,
                postName: row.postName,
                timestamp: row.timestamp.toISOString(),
                status: row.acknowledgedAt ? "ACKNOWLEDGED" : "SUBMITTED",
                summary: row.summary,
                href: `/operations/records/eosr/${row.id}`,
              })),
            )
        : Promise.resolve([]);

    const exceptions =
      !filters.family || filters.family === "exception"
        ? this.database
            .select({
              id: reportingExceptions.id,
              siteId: sites.id,
              siteName: sites.name,
              postName: posts.name,
              timestamp: reportingExceptions.firstDetectedAt,
              state: reportingExceptions.state,
              classification: reportingExceptions.classification,
              obligationType: reportingExceptions.obligationType,
            })
            .from(reportingExceptions)
            .innerJoin(
              shiftAssignments,
              eq(reportingExceptions.shiftAssignmentId, shiftAssignments.id),
            )
            .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
            .innerJoin(posts, eq(shifts.postId, posts.id))
            .innerJoin(sites, eq(posts.siteId, sites.id))
            .innerJoin(clients, eq(sites.clientId, clients.id))
            .where(
              and(
                ...common,
                eq(reportingExceptions.organizationId, scope.organizationId),
                gte(reportingExceptions.firstDetectedAt, startsAt),
                lte(reportingExceptions.firstDetectedAt, endsAt),
                filters.status
                  ? exceptionStatuses.has(filters.status)
                    ? eq(reportingExceptions.state, filters.status)
                    : sql`false`
                  : undefined,
                cursor
                  ? or(
                      lt(reportingExceptions.firstDetectedAt, cursor.timestamp),
                      and(
                        eq(
                          reportingExceptions.firstDetectedAt,
                          cursor.timestamp,
                        ),
                        lt(reportingExceptions.id, cursor.id),
                      ),
                    )
                  : undefined,
              ),
            )
            .orderBy(
              desc(reportingExceptions.firstDetectedAt),
              desc(reportingExceptions.id),
            )
            .limit(fetchLimit)
            .then((rows): ReportHubRow[] =>
              rows.map((row) => ({
                id: row.id,
                family: "exception",
                familyLabel: "Reporting Exception",
                siteId: row.siteId,
                siteName: row.siteName,
                postName: row.postName,
                timestamp: row.timestamp.toISOString(),
                status: row.state,
                summary: `${row.classification} ${row.obligationType.replaceAll("_", " ").toLowerCase()} obligation`,
                href: "/operations/reporting-exceptions",
              })),
            )
        : Promise.resolve([]);

    const [siteRows, activityRows, incidentRows, eosrRows, exceptionRows] =
      await Promise.all([
        sitePromise,
        activities,
        incidents,
        eosrs,
        exceptions,
      ]);
    const merged = sorted([
      ...activityRows,
      ...incidentRows,
      ...eosrRows,
      ...exceptionRows,
    ]);
    const rows = merged.slice(0, limit);
    const last = rows.at(-1);
    return {
      sites: siteRows.slice(0, SITE_OPTION_LIMIT),
      sitesLimited: siteRows.length > SITE_OPTION_LIMIT,
      rows,
      hasMore: merged.length > limit,
      ...(last && merged.length > limit
        ? { nextCursor: `${last.timestamp}|${last.id}` }
        : {}),
    };
  }
}
