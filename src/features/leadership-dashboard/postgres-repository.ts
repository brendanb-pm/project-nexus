import "server-only";

import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import {
  branches,
  clients,
  clockEvents,
  coverageRequirements,
  credentialDefinitions,
  employeeCredentials,
  employees,
  endOfShiftReports,
  incidentReports,
  posts,
  postCredentialRequirements,
  shiftAssignments,
  shifts,
  sites,
  timeRecords,
} from "@/server/db/schema";
import type { CoverageRequirement } from "@/features/coverage/contracts";
import type { CredentialJurisdiction } from "@/features/compliance-admin/canonical";
import type {
  LeadershipDashboardFilters,
  LeadershipDashboardScope,
  LeadershipDashboardSources,
} from "./contracts";
import type { LeadershipDashboardRepository } from "./repository";

function scopePredicate(scope: LeadershipDashboardScope) {
  const tenant = eq(clients.organizationId, scope.organizationId);
  if (scope.organizationWide) return tenant;
  const filters = [];
  if (scope.branchIds.length)
    filters.push(inArray(clients.branchId, [...scope.branchIds]));
  if (scope.clientIds.length)
    filters.push(inArray(clients.id, [...scope.clientIds]));
  if (scope.siteIds.length) filters.push(inArray(sites.id, [...scope.siteIds]));
  return and(tenant, filters.length ? or(...filters) : sql`false`);
}

function selectedHierarchyPredicate(filters: LeadershipDashboardFilters) {
  const predicates = [];
  if (filters.clientId) predicates.push(eq(clients.id, filters.clientId));
  if (filters.siteId) predicates.push(eq(sites.id, filters.siteId));
  return predicates;
}

function employeeScopePredicate(scope: LeadershipDashboardScope) {
  if (scope.organizationWide)
    return eq(employees.organizationId, scope.organizationId);
  return and(
    eq(employees.organizationId, scope.organizationId),
    scope.branchIds.length
      ? inArray(employees.primaryBranchId, [...scope.branchIds])
      : sql`false`,
  );
}

function jurisdiction(row: {
  jurisdictionKind: string;
  jurisdictionCode: string | null;
  jurisdictionTimezone: string | null;
}): CredentialJurisdiction {
  return {
    kind: row.jurisdictionKind as CredentialJurisdiction["kind"],
    ...(row.jurisdictionCode ? { code: row.jurisdictionCode } : {}),
    ...(row.jurisdictionTimezone ? { timezone: row.jurisdictionTimezone } : {}),
  };
}

export class PostgresLeadershipDashboardRepository implements LeadershipDashboardRepository {
  constructor(private readonly database: NexusDatabase) {}

  async load(
    scope: LeadershipDashboardScope,
    filters: LeadershipDashboardFilters,
    window: { startsAt: string; endsAt: string; asOf: string },
  ): Promise<LeadershipDashboardSources> {
    const start = new Date(window.startsAt);
    const end = new Date(window.endsAt);
    const asOf = new Date(window.asOf);
    const hierarchy = selectedHierarchyPredicate(filters);
    const [
      hierarchyRows,
      postRows,
      assignmentRows,
      incidentRows,
      credentialRows,
      requirementRows,
      complianceAssignmentRows,
    ] = await Promise.all([
      this.database
        .select({
          clientId: clients.id,
          clientName: clients.name,
          siteId: sites.id,
          siteName: sites.name,
        })
        .from(sites)
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(and(scopePredicate(scope), eq(sites.active, true), ...hierarchy))
        .orderBy(
          asc(clients.name),
          asc(clients.id),
          asc(sites.name),
          asc(sites.id),
        ),
      this.database
        .select({
          siteId: sites.id,
          siteName: sites.name,
          timezone: sites.timezone,
          clientId: clients.id,
          branchId: clients.branchId,
          postId: posts.id,
          postName: posts.name,
          requirement: coverageRequirements,
        })
        .from(posts)
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .leftJoin(
          coverageRequirements,
          eq(coverageRequirements.postId, posts.id),
        )
        .where(
          and(
            scopePredicate(scope),
            eq(sites.active, true),
            eq(posts.active, true),
            ...hierarchy,
          ),
        )
        .orderBy(
          asc(sites.name),
          asc(sites.id),
          asc(posts.name),
          asc(posts.id),
          asc(coverageRequirements.effectiveStart),
          asc(coverageRequirements.id),
        ),
      this.database
        .select({
          id: shiftAssignments.id,
          postId: shifts.postId,
          startsAt: shifts.scheduledStart,
          endsAt: shifts.scheduledEnd,
          eosrId: endOfShiftReports.id,
          clockOutCount: sql<number>`count(distinct ${clockEvents.id}) filter (where ${clockEvents.eventType} = 'CLOCK_OUT')`,
          actualStartsAt: timeRecords.startsAt,
          actualEndsAt: timeRecords.endsAt,
          actualSeconds: timeRecords.secondsWorked,
        })
        .from(shiftAssignments)
        .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .innerJoin(posts, eq(shifts.postId, posts.id))
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .leftJoin(
          endOfShiftReports,
          eq(endOfShiftReports.shiftAssignmentId, shiftAssignments.id),
        )
        .leftJoin(
          clockEvents,
          eq(clockEvents.shiftAssignmentId, shiftAssignments.id),
        )
        .leftJoin(
          timeRecords,
          eq(timeRecords.shiftAssignmentId, shiftAssignments.id),
        )
        .where(
          and(
            scopePredicate(scope),
            ...hierarchy,
            lt(shifts.scheduledStart, end),
            gt(shifts.scheduledEnd, start),
            sql`${shifts.status} in ('PUBLISHED', 'COMPLETED')`,
            sql`${shiftAssignments.status} in ('assigned', 'confirmed')`,
          ),
        )
        .groupBy(
          shiftAssignments.id,
          shifts.id,
          endOfShiftReports.id,
          timeRecords.id,
        )
        .orderBy(asc(shifts.scheduledStart), asc(shiftAssignments.id)),
      this.database
        .select({
          id: incidentReports.id,
          siteId: incidentReports.siteId,
          postId: shifts.postId,
          occurredAt: incidentReports.occurredAt,
          status: incidentReports.status,
        })
        .from(incidentReports)
        .leftJoin(
          shiftAssignments,
          eq(incidentReports.shiftAssignmentId, shiftAssignments.id),
        )
        .leftJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .innerJoin(sites, eq(incidentReports.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(
          and(
            scopePredicate(scope),
            ...hierarchy,
            lt(incidentReports.occurredAt, end),
            gt(incidentReports.occurredAt, start),
            inArray(incidentReports.status, [
              "SUBMITTED",
              "ACKNOWLEDGED",
              "APPROVED",
              "AMENDED",
            ]),
          ),
        )
        .orderBy(desc(incidentReports.occurredAt), desc(incidentReports.id)),
      this.database
        .select({
          id: employeeCredentials.id,
          employeeId: employees.id,
          branchId: branches.id,
          branchName: branches.name,
          definitionId: credentialDefinitions.id,
          key: credentialDefinitions.key,
          displayName: credentialDefinitions.displayName,
          jurisdictionKind: credentialDefinitions.jurisdictionKind,
          jurisdictionCode: credentialDefinitions.jurisdictionCode,
          jurisdictionTimezone: credentialDefinitions.jurisdictionTimezone,
          warningDays: credentialDefinitions.warningDays,
          state: employeeCredentials.state,
          expiresOn: employeeCredentials.expiresOn,
        })
        .from(employeeCredentials)
        .innerJoin(employees, eq(employeeCredentials.employeeId, employees.id))
        .innerJoin(branches, eq(employees.primaryBranchId, branches.id))
        .innerJoin(
          credentialDefinitions,
          eq(
            employeeCredentials.credentialDefinitionId,
            credentialDefinitions.id,
          ),
        )
        .where(employeeScopePredicate(scope))
        .orderBy(
          asc(employees.id),
          asc(credentialDefinitions.displayName),
          asc(employeeCredentials.id),
        ),
      this.database
        .select({
          id: postCredentialRequirements.id,
          postId: posts.id,
          definitionId: credentialDefinitions.id,
          key: credentialDefinitions.key,
          displayName: credentialDefinitions.displayName,
          severity: postCredentialRequirements.severity,
          effectiveStart: postCredentialRequirements.effectiveStart,
          effectiveEnd: postCredentialRequirements.effectiveEnd,
          jurisdictionKind: credentialDefinitions.jurisdictionKind,
          jurisdictionCode: credentialDefinitions.jurisdictionCode,
          jurisdictionTimezone: credentialDefinitions.jurisdictionTimezone,
        })
        .from(postCredentialRequirements)
        .innerJoin(posts, eq(postCredentialRequirements.postId, posts.id))
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .innerJoin(
          credentialDefinitions,
          eq(
            postCredentialRequirements.credentialDefinitionId,
            credentialDefinitions.id,
          ),
        )
        .where(
          and(
            scopePredicate(scope),
            eq(credentialDefinitions.active, true),
            ...hierarchy,
          ),
        )
        .orderBy(
          asc(posts.id),
          asc(postCredentialRequirements.effectiveStart),
          asc(postCredentialRequirements.id),
        ),
      this.database
        .select({
          id: shiftAssignments.id,
          employeeId: employees.id,
          branchId: branches.id,
          branchName: branches.name,
          postId: posts.id,
          siteId: sites.id,
          siteName: sites.name,
          postName: posts.name,
          startsAt: shifts.scheduledStart,
          endsAt: shifts.scheduledEnd,
          timezone: shifts.timezone,
        })
        .from(shiftAssignments)
        .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .innerJoin(posts, eq(shifts.postId, posts.id))
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .innerJoin(employees, eq(shiftAssignments.employeeId, employees.id))
        .innerJoin(branches, eq(employees.primaryBranchId, branches.id))
        .where(
          and(
            scopePredicate(scope),
            ...hierarchy,
            lt(shifts.scheduledStart, end),
            gt(shifts.scheduledEnd, asOf),
            sql`${shifts.status} in ('PUBLISHED', 'COMPLETED')`,
            sql`${shiftAssignments.status} in ('assigned', 'confirmed')`,
          ),
        )
        .orderBy(asc(shifts.scheduledStart), asc(shiftAssignments.id)),
    ]);

    const sitesById = new Map(
      hierarchyRows.map((row) => [
        row.siteId,
        { id: row.siteId, clientId: row.clientId, name: row.siteName },
      ]),
    );
    const clientsById = new Map(
      hierarchyRows.map((row) => [
        row.clientId,
        { id: row.clientId, name: row.clientName },
      ]),
    );
    const scorecardSites = new Map(
      postRows.map((row) => [
        row.siteId,
        {
          id: row.siteId,
          clientId: row.clientId,
          branchId: row.branchId ?? "",
          name: row.siteName,
          timezone: row.timezone,
        },
      ]),
    );
    const scorecardPosts = new Map(
      postRows.map((row) => [
        row.postId,
        { id: row.postId, siteId: row.siteId, name: row.postName },
      ]),
    );
    const requirements: CoverageRequirement[] = postRows.flatMap((row) =>
      row.requirement
        ? [
            {
              id: row.requirement.id,
              postId: row.postId,
              siteId: row.siteId,
              clientId: row.clientId,
              branchId: row.branchId ?? "",
              timezone: row.timezone,
              requiredCount: row.requirement.requiredCount,
              weekdays: Array.isArray(row.requirement.weekdays)
                ? row.requirement.weekdays.filter(
                    (value): value is CoverageRequirement["weekdays"][number] =>
                      typeof value === "string",
                  )
                : [],
              localStartTime: row.requirement.localStartTime,
              localEndTime: row.requirement.localEndTime,
              effectiveStart: row.requirement.effectiveStart,
              ...(row.requirement.effectiveEnd
                ? { effectiveEnd: row.requirement.effectiveEnd }
                : {}),
              active: row.requirement.active,
              updatedAt: row.requirement.updatedAt.toISOString(),
            },
          ]
        : [],
    );
    return {
      hierarchy: {
        clients: [...clientsById.values()],
        sites: [...sitesById.values()],
      },
      scorecards: {
        sites: [...scorecardSites.values()],
        posts: [...scorecardPosts.values()],
        requirements,
        assignments: assignmentRows.map((row) => ({
          id: row.id,
          postId: row.postId,
          startsAt: row.startsAt.toISOString(),
          endsAt: row.endsAt.toISOString(),
          ...(row.eosrId ? { eosrId: row.eosrId } : {}),
          clockOut: Number(row.clockOutCount) > 0,
          ...(row.actualStartsAt
            ? { actualStartsAt: row.actualStartsAt.toISOString() }
            : {}),
          ...(row.actualEndsAt
            ? { actualEndsAt: row.actualEndsAt.toISOString() }
            : {}),
          ...(row.actualSeconds !== null
            ? { actualSeconds: row.actualSeconds }
            : {}),
        })),
        incidents: incidentRows.map((row) => ({
          id: row.id,
          siteId: row.siteId,
          ...(row.postId ? { postId: row.postId } : {}),
          occurredAt: row.occurredAt.toISOString(),
          status:
            row.status as LeadershipDashboardSources["scorecards"]["incidents"][number]["status"],
        })),
      },
      compliance: {
        credentials: credentialRows.map((row) => ({
          id: row.id,
          employeeId: row.employeeId,
          employeeName: "",
          employeeNumber: "",
          branchId: row.branchId,
          branchName: row.branchName,
          definitionId: row.definitionId,
          key: row.key,
          displayName: row.displayName,
          state:
            row.state as LeadershipDashboardSources["compliance"]["credentials"][number]["state"],
          ...(row.expiresOn ? { expiresOn: row.expiresOn } : {}),
          jurisdiction: jurisdiction(row),
          warningDays: Array.isArray(row.warningDays)
            ? row.warningDays.filter(
                (value): value is number => typeof value === "number",
              )
            : [60, 30, 14, 7],
        })),
        requirements: requirementRows.map((row) => ({
          id: row.id,
          postId: row.postId,
          definitionId: row.definitionId,
          key: row.key,
          displayName: row.displayName,
          severity: row.severity as "required" | "informational",
          jurisdiction: jurisdiction(row),
          effectiveStart: row.effectiveStart,
          ...(row.effectiveEnd ? { effectiveEnd: row.effectiveEnd } : {}),
        })),
        assignments: complianceAssignmentRows.map((row) => ({
          id: row.id,
          employeeId: row.employeeId,
          employeeName: "",
          employeeNumber: "",
          branchId: row.branchId,
          branchName: row.branchName,
          postId: row.postId,
          siteId: row.siteId,
          siteName: row.siteName,
          postName: row.postName,
          startsAt: row.startsAt.toISOString(),
          endsAt: row.endsAt.toISOString(),
          timezone: row.timezone,
        })),
      },
    };
  }
}
