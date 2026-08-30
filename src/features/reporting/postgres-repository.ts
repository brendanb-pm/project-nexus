import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import {
  activityEntries,
  auditEvents,
  clients,
  incidentReports,
  handoffs,
  posts,
  shiftAssignments,
  shifts,
  sites,
} from "@/server/db/schema";
import type { AuditContext } from "@/server/request/boundary";
import type {
  ActivityEntrySummary,
  HandoffSummary,
  IncidentReportSummary,
} from "./contracts";
import { incidentGateFor } from "./incident-gate";
import type {
  ActivityContext,
  NewIncident,
  NewHandoff,
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

const incidentFields = {
  id: incidentReports.id,
  shiftAssignmentId: incidentReports.shiftAssignmentId,
  originatingActivityEntryId: incidentReports.originatingActivityEntryId,
  incidentNumber: incidentReports.incidentNumber,
  classification: incidentReports.classification,
  severity: incidentReports.severity,
  occurredAt: incidentReports.occurredAt,
  narrative: incidentReports.narrative,
  actionsTaken: incidentReports.actionsTaken,
  emergencyServiceInvolvement: incidentReports.emergencyServiceInvolvement,
  externalReportNumber: incidentReports.externalReportNumber,
  status: incidentReports.status,
  visibility: incidentReports.visibility,
  createdAt: incidentReports.createdAt,
};
type IncidentRow = {
  id: string;
  shiftAssignmentId: string | null;
  originatingActivityEntryId: string | null;
  incidentNumber: string;
  classification: string;
  severity: string;
  occurredAt: Date;
  narrative: string;
  actionsTaken: string;
  emergencyServiceInvolvement: boolean;
  externalReportNumber: string | null;
  status: string;
  visibility: IncidentReportSummary["visibility"];
  createdAt: Date;
};
function incidentDto(row: IncidentRow): IncidentReportSummary {
  if (!row.shiftAssignmentId)
    throw new Error("Incident assignment is required");
  return {
    id: row.id,
    shiftAssignmentId: row.shiftAssignmentId,
    ...(row.originatingActivityEntryId
      ? { originatingActivityEntryId: row.originatingActivityEntryId }
      : {}),
    incidentNumber: row.incidentNumber,
    classification:
      row.classification as IncidentReportSummary["classification"],
    severity: row.severity as IncidentReportSummary["severity"],
    occurredAt: row.occurredAt.toISOString(),
    narrative: row.narrative,
    actionsTaken: row.actionsTaken,
    emergencyServiceInvolvement: row.emergencyServiceInvolvement,
    ...(row.externalReportNumber
      ? { externalReportNumber: row.externalReportNumber }
      : {}),
    status: "SUBMITTED",
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
  };
}

const handoffFields = {
  id: handoffs.id,
  shiftAssignmentId: handoffs.shiftAssignmentId,
  unresolvedIssues: handoffs.unresolvedIssues,
  equipmentKeyStatus: handoffs.equipmentKeyStatus,
  followUpItems: handoffs.followUpItems,
  submittedAt: handoffs.submittedAt,
  status: handoffs.status,
  visibility: handoffs.visibility,
  createdAt: handoffs.createdAt,
  siteName: sites.name,
  postName: posts.name,
};
type HandoffRow = {
  id: string;
  shiftAssignmentId: string;
  unresolvedIssues: unknown;
  equipmentKeyStatus: unknown;
  followUpItems: unknown;
  submittedAt: Date | null;
  status: string;
  visibility: HandoffSummary["visibility"];
  createdAt: Date;
  siteName: string;
  postName: string;
};
function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
function handoffDto(row: HandoffRow): HandoffSummary {
  if (!row.submittedAt)
    throw new Error("Submitted handoff timestamp is required");
  return {
    id: row.id,
    shiftAssignmentId: row.shiftAssignmentId,
    siteName: row.siteName,
    postName: row.postName,
    unresolvedIssues: stringList(row.unresolvedIssues),
    equipmentKeyStatus:
      row.equipmentKeyStatus && typeof row.equipmentKeyStatus === "object"
        ? ((row.equipmentKeyStatus as { summary?: unknown })
            .summary as string) || ""
        : "",
    followUpItems: stringList(row.followUpItems),
    submittedAt: row.submittedAt.toISOString(),
    status: "SUBMITTED",
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
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
  async listOwnIncidents(
    scope: ReportingScope,
    employeeId: string,
    limit: number,
  ) {
    const rows = await this.database
      .select(incidentFields)
      .from(incidentReports)
      .innerJoin(
        shiftAssignments,
        eq(incidentReports.shiftAssignmentId, shiftAssignments.id),
      )
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(
        and(scopePredicate(scope), eq(shiftAssignments.employeeId, employeeId)),
      )
      .orderBy(desc(incidentReports.occurredAt), desc(incidentReports.id))
      .limit(limit);
    return rows.map(incidentDto);
  }
  async listIncidents(
    scope: ReportingScope,
    visibility: readonly IncidentReportSummary["visibility"][],
    limit: number,
  ) {
    const rows = await this.database
      .select(incidentFields)
      .from(incidentReports)
      .innerJoin(
        shiftAssignments,
        eq(incidentReports.shiftAssignmentId, shiftAssignments.id),
      )
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(
        and(
          scopePredicate(scope),
          inArray(incidentReports.visibility, [...visibility]),
        ),
      )
      .orderBy(desc(incidentReports.occurredAt), desc(incidentReports.id))
      .limit(limit);
    return rows.map(incidentDto);
  }
  async getOriginatingActivity(
    scope: ReportingScope,
    context: ActivityContext,
    activityEntryId: string,
  ) {
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
        and(
          scopePredicate(scope),
          eq(activityEntries.id, activityEntryId),
          eq(activityEntries.shiftAssignmentId, context.id),
        ),
      )
      .limit(1);
    return rows[0] ? dto(rows[0]) : null;
  }
  async createIncident(
    scope: ReportingScope,
    context: ActivityContext,
    input: NewIncident,
    audit: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const existing = await tx
        .select(incidentFields)
        .from(incidentReports)
        .innerJoin(
          shiftAssignments,
          eq(incidentReports.shiftAssignmentId, shiftAssignments.id),
        )
        .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .innerJoin(posts, eq(shifts.postId, posts.id))
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(
          and(
            scopePredicate(scope),
            eq(incidentReports.shiftAssignmentId, context.id),
            eq(incidentReports.submissionKey, input.submissionKey),
          ),
        )
        .limit(1);
      if (existing[0]) return incidentDto(existing[0]);
      const incidentNumber = `INC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const inserted = await tx
        .insert(incidentReports)
        .values({
          siteId: context.siteId,
          shiftAssignmentId: context.id,
          originatingActivityEntryId: input.originatingActivityEntryId,
          reportedByUserId: audit.actorUserId,
          incidentNumber,
          classification: input.classification,
          severity: input.severity,
          occurredAt: new Date(input.occurredAt),
          narrative: input.narrative,
          actionsTaken: input.actionsTaken,
          emergencyServiceInvolvement: input.emergencyServiceInvolvement,
          externalReportNumber: input.externalReportNumber,
          status: "SUBMITTED",
          visibility: input.visibility,
          submissionKey: input.submissionKey,
        })
        .returning({ id: incidentReports.id });
      const id = inserted[0]!.id;
      await tx.insert(auditEvents).values({
        organizationId: audit.organizationId,
        actorUserId: audit.actorUserId,
        action: "incident-report.submitted",
        entityType: "IncidentReport",
        entityId: id,
        requestId: audit.requestId,
        sessionId: audit.sessionId,
        afterState: {
          shiftAssignmentId: context.id,
          originatingActivityEntryId: input.originatingActivityEntryId,
          classification: input.classification,
          severity: input.severity,
          visibility: input.visibility,
        },
      });
      const created = await tx
        .select(incidentFields)
        .from(incidentReports)
        .where(eq(incidentReports.id, id))
        .limit(1);
      return incidentDto(created[0]!);
    });
  }
  async listOwnHandoffs(
    scope: ReportingScope,
    employeeId: string,
    limit: number,
  ) {
    const rows = await this.database
      .select(handoffFields)
      .from(handoffs)
      .innerJoin(
        shiftAssignments,
        eq(handoffs.shiftAssignmentId, shiftAssignments.id),
      )
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(
        and(scopePredicate(scope), eq(shiftAssignments.employeeId, employeeId)),
      )
      .orderBy(desc(handoffs.submittedAt), desc(handoffs.id))
      .limit(limit);
    return rows.map(handoffDto);
  }
  async createHandoff(
    scope: ReportingScope,
    context: ActivityContext,
    input: NewHandoff,
    audit: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const existing = await tx
        .select(handoffFields)
        .from(handoffs)
        .innerJoin(
          shiftAssignments,
          eq(handoffs.shiftAssignmentId, shiftAssignments.id),
        )
        .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .innerJoin(posts, eq(shifts.postId, posts.id))
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(
          and(
            scopePredicate(scope),
            eq(handoffs.shiftAssignmentId, context.id),
            eq(handoffs.submissionKey, input.submissionKey),
          ),
        )
        .limit(1);
      if (existing[0]) return handoffDto(existing[0]);
      const inserted = await tx
        .insert(handoffs)
        .values({
          shiftAssignmentId: context.id,
          unresolvedIssues: input.unresolvedIssues,
          equipmentKeyStatus: { summary: input.equipmentKeyStatus },
          followUpItems: input.followUpItems,
          submittedAt: new Date(input.submittedAt),
          submissionKey: input.submissionKey,
          status: "SUBMITTED",
          visibility: input.visibility,
        })
        .returning({ id: handoffs.id });
      const id = inserted[0]!.id;
      await tx.insert(auditEvents).values({
        organizationId: audit.organizationId,
        actorUserId: audit.actorUserId,
        action: "handoff.submitted",
        entityType: "Handoff",
        entityId: id,
        requestId: audit.requestId,
        sessionId: audit.sessionId,
        afterState: {
          shiftAssignmentId: context.id,
          unresolvedIssueCount: input.unresolvedIssues.length,
          followUpItemCount: input.followUpItems.length,
          visibility: input.visibility,
        },
      });
      const created = await tx
        .select(handoffFields)
        .from(handoffs)
        .innerJoin(
          shiftAssignments,
          eq(handoffs.shiftAssignmentId, shiftAssignments.id),
        )
        .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .innerJoin(posts, eq(shifts.postId, posts.id))
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(eq(handoffs.id, id))
        .limit(1);
      return handoffDto(created[0]!);
    });
  }
}
