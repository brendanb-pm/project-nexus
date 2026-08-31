import "server-only";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import {
  activityEntries,
  clients,
  clockEvents,
  incidentReports,
  posts,
  shiftAssignments,
  shifts,
  sites,
} from "@/server/db/schema";
import type { OperationsException } from "./contracts";
import type { OperationsRepository, OperationsScope } from "./repository";

function scopePredicate(scope: OperationsScope) {
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

export class PostgresOperationsRepository implements OperationsRepository {
  constructor(private readonly database: NexusDatabase) {}

  async listExceptions(scope: OperationsScope, _now: string, limit: number) {
    const base = [
      eq(posts.siteId, sites.id),
      eq(sites.clientId, clients.id),
      scopePredicate(scope),
    ];
    const [incidents, activities, clocks] = await Promise.all([
      this.database
        .select({
          id: incidentReports.id,
          occurredAt: incidentReports.occurredAt,
          severity: incidentReports.severity,
          siteId: sites.id,
          postId: shifts.postId,
          clientId: clients.id,
          branchId: clients.branchId,
        })
        .from(incidentReports)
        .innerJoin(sites, eq(incidentReports.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .leftJoin(
          shiftAssignments,
          eq(incidentReports.shiftAssignmentId, shiftAssignments.id),
        )
        .leftJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .leftJoin(posts, eq(shifts.postId, posts.id))
        .where(
          and(
            eq(incidentReports.status, "SUBMITTED"),
            sql`${incidentReports.acknowledgedAt} is null`,
            scopePredicate(scope),
          ),
        )
        .orderBy(asc(incidentReports.occurredAt), asc(incidentReports.id))
        .limit(limit),
      this.database
        .select({
          id: activityEntries.id,
          occurredAt: activityEntries.occurredAt,
          siteId: sites.id,
          postId: shifts.postId,
          clientId: clients.id,
          branchId: clients.branchId,
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
            eq(activityEntries.followUpRequired, true),
            sql`${activityEntries.acknowledgedAt} is null`,
            ...base,
          ),
        )
        .orderBy(asc(activityEntries.occurredAt), asc(activityEntries.id))
        .limit(limit),
      this.database
        .select({
          id: clockEvents.id,
          effectiveAt: clockEvents.effectiveAt,
          assignmentId: shiftAssignments.id,
          shiftId: shifts.id,
          siteId: sites.id,
          postId: posts.id,
          clientId: clients.id,
          branchId: clients.branchId,
        })
        .from(clockEvents)
        .innerJoin(
          shiftAssignments,
          eq(clockEvents.shiftAssignmentId, shiftAssignments.id),
        )
        .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .innerJoin(posts, eq(shifts.postId, posts.id))
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(
          and(
            eq(clockEvents.verificationStatus, "EXCEPTION_REQUIRED"),
            ...base,
          ),
        )
        .orderBy(asc(clockEvents.effectiveAt), asc(clockEvents.id))
        .limit(limit),
    ]);
    const items: OperationsException[] = [
      ...incidents
        .filter((r) => r.postId && r.branchId)
        .map((r) => ({
          id: `incident:${r.id}`,
          type: "INCIDENT_AWAITING_REVIEW" as const,
          severity:
            r.severity === "CRITICAL" || r.severity === "HIGH"
              ? ("URGENT" as const)
              : ("REVIEW" as const),
          effectiveAt: r.occurredAt.toISOString(),
          organizationId: scope.organizationId,
          branchId: r.branchId!,
          clientId: r.clientId,
          siteId: r.siteId,
          postId: r.postId!,
          source: {
            entityType: "IncidentReport",
            entityId: r.id,
            href: "/reporting",
          },
          title: "Incident awaiting review",
          detail: "Review the submitted incident.",
        })),
      ...activities
        .filter((r) => r.branchId)
        .map((r) => ({
          id: `activity:${r.id}`,
          type: "OPERATIONAL_RECORD_AWAITING_REVIEW" as const,
          severity: "REVIEW" as const,
          effectiveAt: r.occurredAt.toISOString(),
          organizationId: scope.organizationId,
          branchId: r.branchId!,
          clientId: r.clientId,
          siteId: r.siteId,
          postId: r.postId,
          source: {
            entityType: "ActivityEntry",
            entityId: r.id,
            href: "/reporting",
          },
          title: "Activity follow-up awaiting review",
          detail: "Review the submitted activity.",
        })),
      ...clocks.map((r) => ({
        id: `clock:${r.id}`,
        type: "CLOCK_EXCEPTION" as const,
        severity: "URGENT" as const,
        effectiveAt: r.effectiveAt.toISOString(),
        organizationId: scope.organizationId,
        branchId: r.branchId!,
        clientId: r.clientId,
        siteId: r.siteId,
        postId: r.postId,
        shiftId: r.shiftId,
        assignmentId: r.assignmentId,
        source: {
          entityType: "ClockEvent",
          entityId: r.id,
          href: "/admin/scheduling",
        },
        title: "Clock exception requires review",
        detail: "Review the timekeeping exception.",
      })),
    ]
      .sort(
        (a, b) =>
          a.effectiveAt.localeCompare(b.effectiveAt) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, limit);
    return { items, hasMore: items.length === limit };
  }
}
