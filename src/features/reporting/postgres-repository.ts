import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import {
  activityEntries,
  auditEvents,
  clients,
  posts,
  shiftAssignments,
  shifts,
  sites,
} from "@/server/db/schema";
import type { AuditContext } from "@/server/request/boundary";
import type { ActivityEntrySummary } from "./contracts";
import { incidentGateFor } from "./incident-gate";
import type {
  ActivityContext,
  NewActivity,
  ReportingRepository,
  ReportingScope,
} from "./repository";

function scopePredicate(scope: ReportingScope) {
  if (scope.organizationWide)
    return eq(clients.organizationId, scope.organizationId);
  const filters = [];
  if (scope.branchIds.length)
    filters.push(inArray(clients.branchId, [...scope.branchIds]));
  if (scope.clientIds.length)
    filters.push(inArray(clients.id, [...scope.clientIds]));
  if (scope.siteIds.length) filters.push(inArray(sites.id, [...scope.siteIds]));
  return and(
    eq(clients.organizationId, scope.organizationId),
    filters.length ? or(...filters) : sql`false`,
  );
}
const fields = {
  id: activityEntries.id,
  shiftAssignmentId: activityEntries.shiftAssignmentId,
  occurredAt: activityEntries.occurredAt,
  category: activityEntries.category,
  description: activityEntries.description,
  actionTaken: activityEntries.actionTaken,
  followUpRequired: activityEntries.followUpRequired,
  incidentRelated: activityEntries.incidentRelated,
  incidentGate: activityEntries.incidentGate,
  visibility: activityEntries.visibility,
  status: activityEntries.status,
  createdAt: activityEntries.createdAt,
  siteName: sites.name,
  postName: posts.name,
};
type ActivityRow = {
  id: string;
  shiftAssignmentId: string;
  occurredAt: Date;
  category: string;
  description: unknown;
  actionTaken: string | null;
  followUpRequired: boolean;
  incidentRelated: boolean;
  incidentGate: string;
  visibility: ActivityEntrySummary["visibility"];
  status: string;
  createdAt: Date;
  siteName: string;
  postName: string;
};
function dto(row: ActivityRow): ActivityEntrySummary {
  const description =
    row.description && typeof row.description === "object"
      ? (row.description as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    shiftAssignmentId: row.shiftAssignmentId,
    siteName: row.siteName,
    postName: row.postName,
    occurredAt: row.occurredAt.toISOString(),
    category: row.category as ActivityEntrySummary["category"],
    ...(typeof description.locationContext === "string"
      ? { locationContext: description.locationContext }
      : {}),
    narrative:
      typeof description.narrative === "string" ? description.narrative : "",
    ...(row.actionTaken ? { actionTaken: row.actionTaken } : {}),
    followUpRequired: row.followUpRequired,
    visibility: row.visibility,
    status: "SUBMITTED",
    createdAt: row.createdAt.toISOString(),
    incidentGate: row.incidentGate as ActivityEntrySummary["incidentGate"],
  };
}

export class PostgresReportingRepository implements ReportingRepository {
  constructor(private readonly database: NexusDatabase) {}
  async listOwnAssignments(
    scope: ReportingScope,
    employeeId: string,
    limit: number,
  ) {
    const rows = await this.database
      .select({
        id: shiftAssignments.id,
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
      .where(
        and(
          scopePredicate(scope),
          eq(shiftAssignments.employeeId, employeeId),
          inArray(shiftAssignments.status, ["assigned", "confirmed"]),
        ),
      )
      .orderBy(desc(shifts.scheduledStart), asc(shiftAssignments.id))
      .limit(limit);
    return rows.map((row) => ({
      ...row,
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledEnd: row.scheduledEnd.toISOString(),
    }));
  }
  async getActivityContext(scope: ReportingScope, assignmentId: string) {
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
      .where(and(scopePredicate(scope), eq(shiftAssignments.id, assignmentId)))
      .limit(1);
    const row = rows[0];
    if (!row?.branchId) return null;
    return {
      ...row,
      branchId: row.branchId,
      assignmentStatus:
        row.assignmentStatus as ActivityContext["assignmentStatus"],
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledEnd: row.scheduledEnd.toISOString(),
    };
  }
  async listRecent(scope: ReportingScope, employeeId: string, limit: number) {
    const rows = await this.database
      .select(fields)
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
        and(scopePredicate(scope), eq(shiftAssignments.employeeId, employeeId)),
      )
      .orderBy(desc(activityEntries.occurredAt), desc(activityEntries.id))
      .limit(limit);
    return rows.map(dto);
  }
  async createActivity(
    scope: ReportingScope,
    context: ActivityContext,
    input: NewActivity,
    audit: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const existing = await tx
        .select(fields)
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
            scopePredicate(scope),
            eq(activityEntries.shiftAssignmentId, context.id),
            eq(activityEntries.submissionKey, input.submissionKey),
          ),
        )
        .limit(1);
      if (existing[0]) return dto(existing[0]);
      const inserted = await tx
        .insert(activityEntries)
        .values({
          shiftAssignmentId: context.id,
          occurredAt: new Date(input.occurredAt),
          category: input.category,
          postId: context.postId,
          description: {
            narrative: input.narrative,
            ...(input.locationContext
              ? { locationContext: input.locationContext }
              : {}),
          },
          actionTaken: input.actionTaken,
          followUpRequired: input.followUpRequired,
          incidentRelated: incidentGateFor(input.category) !== "ROUTINE",
          incidentGate: incidentGateFor(input.category),
          visibility: input.visibility,
          status: "SUBMITTED",
          submissionKey: input.submissionKey,
        })
        .returning({ id: activityEntries.id });
      const id = inserted[0]!.id;
      await tx.insert(auditEvents).values({
        organizationId: audit.organizationId,
        actorUserId: audit.actorUserId,
        action: "activity-entry.submitted",
        entityType: "ActivityEntry",
        entityId: id,
        requestId: audit.requestId,
        sessionId: audit.sessionId,
        afterState: {
          shiftAssignmentId: context.id,
          category: input.category,
          followUpRequired: input.followUpRequired,
          visibility: input.visibility,
        },
      });
      const created = await tx
        .select(fields)
        .from(activityEntries)
        .innerJoin(
          shiftAssignments,
          eq(activityEntries.shiftAssignmentId, shiftAssignments.id),
        )
        .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .innerJoin(posts, eq(shifts.postId, posts.id))
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(eq(activityEntries.id, id))
        .limit(1);
      return dto(created[0]!);
    });
  }
}
