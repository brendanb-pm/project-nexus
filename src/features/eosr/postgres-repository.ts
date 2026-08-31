import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { NexusDatabase } from "@/server/db/client";
import {
  auditEvents,
  clients,
  clockEvents,
  endOfShiftReports,
  eosrPassdownDismissals,
  posts,
  shiftAssignments,
  shifts,
  sites,
} from "@/server/db/schema";
import type {
  ActivityContext,
  ReportingScope,
} from "@/features/reporting/repository";
import type { AuditContext } from "@/server/request/boundary";
import type {
  EndOfShiftReport,
  IncomingPassdown,
  ShiftCloseStatus,
} from "./contracts";
import type { EndOfShiftReportRepository } from "./repository";

const predicate = (scope: ReportingScope) => {
  const tenant = eq(clients.organizationId, scope.organizationId);
  if (scope.organizationWide) return tenant;
  const filters = [];
  if (scope.branchIds.length)
    filters.push(inArray(clients.branchId, [...scope.branchIds]));
  if (scope.clientIds.length)
    filters.push(inArray(clients.id, [...scope.clientIds]));
  if (scope.siteIds.length) filters.push(inArray(sites.id, [...scope.siteIds]));
  return and(tenant, filters.length ? or(...filters) : sql`false`);
};
export class PostgresEndOfShiftReportRepository implements EndOfShiftReportRepository {
  constructor(private readonly database: NexusDatabase) {}
  async getAssignment(scope: ReportingScope, assignmentId: string) {
    const rows = await this.database
      .select({
        id: shiftAssignments.id,
        organizationId: clients.organizationId,
        branchId: clients.branchId,
        clientId: clients.id,
        siteId: sites.id,
        postId: posts.id,
        employeeId: shiftAssignments.employeeId,
        assignmentStatus: shiftAssignments.status,
        siteName: sites.name,
        postName: posts.name,
        scheduledStart: shifts.scheduledStart,
        scheduledEnd: shifts.scheduledEnd,
      })
      .from(shiftAssignments)
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(and(predicate(scope), eq(shiftAssignments.id, assignmentId)))
      .limit(1);
    const row = rows[0];
    return row && row.branchId
      ? {
          ...row,
          branchId: row.branchId,
          assignmentStatus:
            row.assignmentStatus as ActivityContext["assignmentStatus"],
          scheduledStart: row.scheduledStart.toISOString(),
          scheduledEnd: row.scheduledEnd.toISOString(),
        }
      : null;
  }
  async create(
    scope: ReportingScope,
    context: ActivityContext,
    input: Parameters<EndOfShiftReportRepository["create"]>[2],
    audit: AuditContext,
  ) {
    const row = await this.database.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(endOfShiftReports)
        .where(
          and(
            eq(endOfShiftReports.shiftAssignmentId, context.id),
            eq(endOfShiftReports.submissionKey, input.submissionKey),
          ),
        )
        .limit(1);
      if (existing[0]) return existing[0];
      const inserted = await tx
        .insert(endOfShiftReports)
        .values({
          shiftAssignmentId: context.id,
          submittedByUserId: input.submittedByUserId,
          summary: input.summary,
          unresolvedIssues: [...input.unresolvedIssues],
          equipmentAccessStatus: input.equipmentAccessStatus,
          followUpItems: [...input.followUpItems],
          unusualConditions: input.unusualConditions,
          submissionKey: input.submissionKey,
          submittedAt: new Date(),
        })
        .returning();
      const created = inserted[0]!;
      await tx.insert(auditEvents).values({
        organizationId: audit.organizationId,
        actorUserId: audit.actorUserId,
        action: "end-of-shift-report.submitted",
        entityType: "EndOfShiftReport",
        entityId: created.id,
        requestId: audit.requestId,
        sessionId: audit.sessionId,
        afterState: {
          shiftAssignmentId: context.id,
          summary: created.summary,
          passdownPresent: Boolean(
            (Array.isArray(created.unresolvedIssues) &&
              created.unresolvedIssues.length) ||
            (Array.isArray(created.followUpItems) &&
              created.followUpItems.length) ||
            created.equipmentAccessStatus ||
            created.unusualConditions,
          ),
        },
      });
      return created;
    });
    return dto(row, context.siteName, context.postName);
  }
  async listIncomingPassdowns(
    scope: ReportingScope,
    employeeId: string,
    actorUserId: string,
    limit: number,
  ) {
    const outgoingAssignments = alias(shiftAssignments, "outgoing_assignments");
    const outgoingShifts = alias(shifts, "outgoing_shifts");
    const rows = await this.database
      .select({
        report: endOfShiftReports,
        incomingId: shiftAssignments.id,
        siteName: sites.name,
        postName: posts.name,
        dismissal: eosrPassdownDismissals,
      })
      .from(shiftAssignments)
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .innerJoin(
        outgoingShifts,
        and(
          eq(outgoingShifts.postId, shifts.postId),
          lte(outgoingShifts.scheduledEnd, shifts.scheduledStart),
        ),
      )
      .innerJoin(
        outgoingAssignments,
        eq(outgoingAssignments.shiftId, outgoingShifts.id),
      )
      .innerJoin(
        endOfShiftReports,
        eq(endOfShiftReports.shiftAssignmentId, outgoingAssignments.id),
      )
      .leftJoin(
        eosrPassdownDismissals,
        and(
          eq(eosrPassdownDismissals.endOfShiftReportId, endOfShiftReports.id),
          eq(eosrPassdownDismissals.incomingAssignmentId, shiftAssignments.id),
          eq(eosrPassdownDismissals.dismissedByUserId, actorUserId),
        ),
      )
      .where(and(predicate(scope), eq(shiftAssignments.employeeId, employeeId)))
      .orderBy(asc(outgoingShifts.scheduledEnd), asc(endOfShiftReports.id))
      .limit(limit);
    return rows.map((row) => ({
      ...dto(row.report, row.siteName, row.postName),
      incomingAssignmentId: row.incomingId,
      dismissed: Boolean(row.dismissal && !row.dismissal.reopenedAt),
    }));
  }
  async setPassdownDismissal(
    _scope: ReportingScope,
    passdown: IncomingPassdown,
    actorUserId: string,
    dismissed: boolean,
    at: string,
    audit: AuditContext,
  ) {
    await this.database
      .insert(eosrPassdownDismissals)
      .values({
        endOfShiftReportId: passdown.id,
        incomingAssignmentId: passdown.incomingAssignmentId,
        dismissedByUserId: actorUserId,
        dismissedAt: new Date(at),
        ...(dismissed ? {} : { reopenedAt: new Date(at) }),
      })
      .onConflictDoUpdate({
        target: [
          eosrPassdownDismissals.endOfShiftReportId,
          eosrPassdownDismissals.incomingAssignmentId,
          eosrPassdownDismissals.dismissedByUserId,
        ],
        set: dismissed
          ? { dismissedAt: new Date(at), reopenedAt: null }
          : { reopenedAt: new Date(at) },
      });
    await this.database.insert(auditEvents).values({
      organizationId: audit.organizationId,
      actorUserId: audit.actorUserId,
      action: dismissed ? "eosr-passdown.dismissed" : "eosr-passdown.reopened",
      entityType: "EndOfShiftReport",
      entityId: passdown.id,
      requestId: audit.requestId,
      sessionId: audit.sessionId,
    });
    return { ...passdown, dismissed };
  }
  async listShiftClose(scope: ReportingScope, limit: number) {
    const rows = await this.database
      .select({
        shiftId: shifts.id,
        assignmentId: shiftAssignments.id,
        siteId: sites.id,
        postId: posts.id,
        scheduledEnd: shifts.scheduledEnd,
        eosrId: endOfShiftReports.id,
        unresolvedIssues: endOfShiftReports.unresolvedIssues,
        equipment: endOfShiftReports.equipmentAccessStatus,
        followUps: endOfShiftReports.followUpItems,
        unusual: endOfShiftReports.unusualConditions,
        clockOut: sql<number>`count(${clockEvents.id}) filter (where ${clockEvents.eventType} = 'CLOCK_OUT')`,
      })
      .from(shifts)
      .innerJoin(shiftAssignments, eq(shiftAssignments.shiftId, shifts.id))
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
      .where(and(predicate(scope), lte(shifts.scheduledEnd, new Date())))
      .groupBy(
        shifts.id,
        shiftAssignments.id,
        sites.id,
        posts.id,
        endOfShiftReports.id,
      )
      .orderBy(asc(shifts.scheduledEnd), asc(shifts.id))
      .limit(limit);
    return rows.map((row): ShiftCloseStatus => ({
      shiftId: row.shiftId,
      assignmentId: row.assignmentId,
      siteId: row.siteId,
      postId: row.postId,
      scheduledEnd: row.scheduledEnd.toISOString(),
      clockOutComplete: Number(row.clockOut) > 0,
      eosrComplete: Boolean(row.eosrId),
      passdownPresent: Boolean(
        (Array.isArray(row.unresolvedIssues) && row.unresolvedIssues.length) ||
        (Array.isArray(row.followUps) && row.followUps.length) ||
        row.equipment ||
        row.unusual,
      ),
    }));
  }
}
function dto(
  row: typeof endOfShiftReports.$inferSelect,
  siteName: string,
  postName: string,
): EndOfShiftReport {
  return {
    id: row.id,
    shiftAssignmentId: row.shiftAssignmentId,
    siteName,
    postName,
    summary: row.summary,
    unresolvedIssues: Array.isArray(row.unresolvedIssues)
      ? row.unresolvedIssues.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    equipmentAccessStatus: row.equipmentAccessStatus,
    followUpItems: Array.isArray(row.followUpItems)
      ? row.followUpItems.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    unusualConditions: row.unusualConditions,
    submittedByUserId: row.submittedByUserId,
    submittedAt: row.submittedAt.toISOString(),
    ...(row.acknowledgedByUserId
      ? { acknowledgedByUserId: row.acknowledgedByUserId }
      : {}),
    ...(row.acknowledgedAt
      ? { acknowledgedAt: row.acknowledgedAt.toISOString() }
      : {}),
  };
}
