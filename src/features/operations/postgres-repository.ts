import "server-only";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import {
  clients,
  clockEvents,
  endOfShiftReports,
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
    const [shiftCloses, clocks] = await Promise.all([
      this.database
        .select({
          assignmentId: shiftAssignments.id,
          shiftId: shifts.id,
          scheduledEnd: shifts.scheduledEnd,
          eosrId: endOfShiftReports.id,
          clockOutCount: sql<number>`count(${clockEvents.id}) filter (where ${clockEvents.eventType} = 'CLOCK_OUT')`,
          siteId: sites.id,
          postId: posts.id,
          siteName: sites.name,
          postName: posts.name,
          clientId: clients.id,
          branchId: clients.branchId,
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
        .where(
          and(
            scopePredicate(scope),
            sql`${shifts.scheduledEnd} <= ${new Date(_now)}`,
            sql`${shiftAssignments.status} <> 'cancelled'`,
          ),
        )
        .groupBy(
          shiftAssignments.id,
          shifts.id,
          sites.id,
          posts.id,
          clients.id,
          endOfShiftReports.id,
        )
        .orderBy(asc(shifts.scheduledEnd), asc(shiftAssignments.id))
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
      ...shiftCloses
        .filter((r) => !r.eosrId || Number(r.clockOutCount) === 0)
        .map((r) => {
          const missing = [
            ...(!r.eosrId ? ["EOSR"] : []),
            ...(Number(r.clockOutCount) === 0 ? ["clock-out"] : []),
          ];
          return {
            id: `shift-close:${r.assignmentId}`,
            type: "SHIFT_CLOSE_INCOMPLETE" as const,
            severity: "URGENT" as const,
            effectiveAt: r.scheduledEnd.toISOString(),
            organizationId: scope.organizationId,
            branchId: r.branchId!,
            clientId: r.clientId,
            siteId: r.siteId,
            postId: r.postId,
            shiftId: r.shiftId,
            assignmentId: r.assignmentId,
            source: {
              entityType: "ShiftAssignment",
              entityId: r.assignmentId,
              href: `/admin/scheduling?assignmentId=${r.assignmentId}`,
            },
            title: "Shift close incomplete",
            detail: `${r.siteName} / ${r.postName}: missing ${missing.join(" and ")}.`,
          };
        }),
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
