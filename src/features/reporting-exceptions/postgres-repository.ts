import "server-only";

import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import {
  activityEntries,
  auditEvents,
  clients,
  clockEvents,
  employees,
  endOfShiftReports,
  incidentReports,
  posts,
  reportingExceptionEvents,
  reportingExceptions,
  shiftAssignments,
  shifts,
  sites,
  timeRecords,
  users,
} from "@/server/db/schema";
import type { AuditContext } from "@/server/request/boundary";
import type {
  ReportingExceptionEvent,
  ReportingExceptionState,
  ReportingExceptionSummary,
  ReportingExceptionTransition,
} from "./contracts";
import { deriveReportingObligations } from "./policy";
import type {
  ReportingExceptionRepository,
  ReportingExceptionScope,
} from "./repository";

function scopePredicate(scope: ReportingExceptionScope) {
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

function href(
  type: ReportingExceptionSummary["obligationType"],
  assignmentId: string,
) {
  return type === "EOSR"
    ? `/reporting?assignmentId=${assignmentId}#shift-closeout`
    : `/reporting?assignmentId=${assignmentId}`;
}

function summary(row: {
  id: string;
  organizationId: string;
  assignmentId: string;
  employeeId: string;
  branchId: string | null;
  clientId: string;
  siteId: string;
  postId: string;
  obligationType: string;
  classification: string;
  state: string;
  dueAt: Date;
  effectiveShiftEndAt: Date;
  firstDetectedAt: Date;
  correctedAt: Date | null;
  resolvedAt: Date | null;
  assigneeUserId: string | null;
  revision: number;
}): ReportingExceptionSummary {
  return {
    id: row.id,
    organizationId: row.organizationId,
    assignmentId: row.assignmentId,
    employeeId: row.employeeId,
    branchId: row.branchId ?? "",
    clientId: row.clientId,
    siteId: row.siteId,
    postId: row.postId,
    obligationType:
      row.obligationType as ReportingExceptionSummary["obligationType"],
    classification:
      row.classification as ReportingExceptionSummary["classification"],
    state: row.state as ReportingExceptionState,
    dueAt: row.dueAt.toISOString(),
    effectiveShiftEndAt: row.effectiveShiftEndAt.toISOString(),
    firstDetectedAt: row.firstDetectedAt.toISOString(),
    ...(row.correctedAt ? { correctedAt: row.correctedAt.toISOString() } : {}),
    ...(row.resolvedAt ? { resolvedAt: row.resolvedAt.toISOString() } : {}),
    ...(row.assigneeUserId ? { assigneeUserId: row.assigneeUserId } : {}),
    revision: row.revision,
    sourceHref: href(
      row.obligationType as ReportingExceptionSummary["obligationType"],
      row.assignmentId,
    ),
  };
}

export class PostgresReportingExceptionRepository implements ReportingExceptionRepository {
  constructor(private readonly database: NexusDatabase) {}

  async reconcile(scope: ReportingExceptionScope, now: string) {
    const assignments = await this.database
      .select({
        assignmentId: shiftAssignments.id,
        employeeId: shiftAssignments.employeeId,
        assignmentStatus: shiftAssignments.status,
        organizationId: clients.organizationId,
        branchId: clients.branchId,
        clientId: clients.id,
        siteId: sites.id,
        postId: posts.id,
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
          sql`${shiftAssignments.status} <> 'cancelled'`,
        ),
      )
      .orderBy(asc(shifts.scheduledEnd), asc(shiftAssignments.id))
      .limit(500);
    if (!assignments.length) return;
    const ids = assignments.map((a) => a.assignmentId);
    const [clocks, times, eosrs, activities, incidents] = await Promise.all([
      this.database
        .select({
          assignmentId: clockEvents.shiftAssignmentId,
          type: clockEvents.eventType,
          effectiveAt: clockEvents.effectiveAt,
        })
        .from(clockEvents)
        .where(inArray(clockEvents.shiftAssignmentId, ids)),
      this.database
        .select({
          assignmentId: timeRecords.shiftAssignmentId,
          status: timeRecords.status,
          seconds: timeRecords.secondsWorked,
          minutes: timeRecords.minutesWorked,
        })
        .from(timeRecords)
        .where(inArray(timeRecords.shiftAssignmentId, ids)),
      this.database
        .select({
          assignmentId: endOfShiftReports.shiftAssignmentId,
          submittedAt: endOfShiftReports.submittedAt,
        })
        .from(endOfShiftReports)
        .where(inArray(endOfShiftReports.shiftAssignmentId, ids)),
      this.database
        .select({
          id: activityEntries.id,
          assignmentId: activityEntries.shiftAssignmentId,
          incidentGate: activityEntries.incidentGate,
          createdAt: activityEntries.createdAt,
        })
        .from(activityEntries)
        .where(
          and(
            inArray(activityEntries.shiftAssignmentId, ids),
            eq(activityEntries.status, "SUBMITTED"),
          ),
        ),
      this.database
        .select({
          activityId: incidentReports.originatingActivityEntryId,
          createdAt: incidentReports.createdAt,
        })
        .from(incidentReports)
        .where(
          and(
            inArray(incidentReports.shiftAssignmentId, ids),
            eq(incidentReports.status, "SUBMITTED"),
          ),
        ),
    ]);
    const by = <T extends { assignmentId: string }>(rows: readonly T[]) => {
      const result = new Map<string, T[]>();
      for (const row of rows)
        result.set(row.assignmentId, [
          ...(result.get(row.assignmentId) ?? []),
          row,
        ]);
      return result;
    };
    const clockBy = by(clocks);
    const timeBy = by(times);
    const eosrBy = by(eosrs);
    const activitiesBy = by(activities);
    const incidentByActivity = new Map(
      incidents
        .filter((i) => i.activityId)
        .map((i) => [i.activityId!, i.createdAt]),
    );
    for (const assignment of assignments) {
      const clockRows = clockBy.get(assignment.assignmentId) ?? [];
      const clockIn = clockRows.some((row) => row.type === "CLOCK_IN");
      const clockOut = clockRows
        .filter((row) => row.type === "CLOCK_OUT")
        .sort(
          (a, b) => b.effectiveAt.valueOf() - a.effectiveAt.valueOf(),
        )[0]?.effectiveAt;
      const approvedPositive = (timeBy.get(assignment.assignmentId) ?? []).some(
        (row) =>
          row.status === "APPROVED" &&
          ((row.seconds ?? 0) > 0 || (row.minutes ?? 0) > 0),
      );
      const sourceActivities = activitiesBy.get(assignment.assignmentId) ?? [];
      const obligationRows = deriveReportingObligations(
        {
          assignmentId: assignment.assignmentId,
          organizationId: assignment.organizationId,
          effectiveShiftEndAt: (
            clockOut ?? assignment.scheduledEnd
          ).toISOString(),
          clockedIn: clockIn,
          positiveApprovedTimeRecord: approvedPositive,
          eosrSubmittedAt: eosrBy
            .get(assignment.assignmentId)?.[0]
            ?.submittedAt.toISOString(),
          activitySubmittedAt: sourceActivities[0]?.createdAt.toISOString(),
          reportableActivities: sourceActivities
            .filter((a) => a.incidentGate === "REQUIRED")
            .map((a) => ({
              id: a.id,
              submittedAt: a.createdAt.toISOString(),
              ...(incidentByActivity.get(a.id)
                ? {
                    incidentSubmittedAt: incidentByActivity
                      .get(a.id)!
                      .toISOString(),
                  }
                : {}),
            })),
        },
        new Date(now),
      );
      for (const obligation of obligationRows)
        await this.materialize(scope, assignment.assignmentId, obligation, now);
    }
  }

  private async materialize(
    scope: ReportingExceptionScope,
    assignmentId: string,
    obligation: ReturnType<typeof deriveReportingObligations>[number],
    now: string,
  ) {
    await this.database.transaction(async (tx) => {
      const inserted = await tx
        .insert(reportingExceptions)
        .values({
          organizationId: scope.organizationId,
          shiftAssignmentId: assignmentId,
          triggeringActivityEntryId: obligation.triggeringActivityEntryId,
          obligationKey: obligation.key,
          obligationType: obligation.type,
          classification: obligation.classification,
          state: obligation.fulfilledAt ? "CORRECTED_PENDING_REVIEW" : "OPEN",
          dueAt: new Date(obligation.dueAt),
          effectiveShiftEndAt: new Date(obligation.effectiveShiftEndAt),
          firstDetectedAt: new Date(now),
          ...(obligation.fulfilledAt
            ? { correctedAt: new Date(obligation.fulfilledAt) }
            : {}),
        })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
        await tx.insert(reportingExceptionEvents).values({
          reportingExceptionId: inserted[0].id,
          nextState: inserted[0].state,
          reason: obligation.fulfilledAt
            ? "Delayed submission detected by canonical reconciliation."
            : "Reporting obligation detected by canonical reconciliation.",
          actorKind: "SYSTEM",
          occurredAt: new Date(now),
        });
        return;
      }
      const existing = await tx
        .select()
        .from(reportingExceptions)
        .where(eq(reportingExceptions.obligationKey, obligation.key))
        .limit(1);
      const current = existing[0];
      if (!current) return;
      const nextState =
        obligation.fulfilledAt &&
        !["RESOLVED", "WAIVED", "CORRECTED_PENDING_REVIEW"].includes(
          current.state,
        )
          ? "CORRECTED_PENDING_REVIEW"
          : current.state;
      const classificationChanged =
        current.classification !== obligation.classification;
      if (nextState === current.state && !classificationChanged) return;
      await tx
        .update(reportingExceptions)
        .set({
          state: nextState,
          classification: obligation.classification,
          ...(obligation.fulfilledAt
            ? { correctedAt: new Date(obligation.fulfilledAt) }
            : {}),
          revision: current.revision + 1,
          updatedAt: new Date(now),
        })
        .where(
          and(
            eq(reportingExceptions.id, current.id),
            eq(reportingExceptions.revision, current.revision),
          ),
        );
      await tx.insert(reportingExceptionEvents).values({
        reportingExceptionId: current.id,
        previousState: current.state,
        nextState,
        reason: obligation.fulfilledAt
          ? "Canonical delayed submission recorded; review remains required."
          : "Canonical obligation advanced from late to missing.",
        actorKind: "SYSTEM",
        occurredAt: new Date(now),
      });
    });
  }

  private base() {
    return this.database
      .select({
        id: reportingExceptions.id,
        organizationId: reportingExceptions.organizationId,
        assignmentId: reportingExceptions.shiftAssignmentId,
        employeeId: shiftAssignments.employeeId,
        branchId: clients.branchId,
        clientId: clients.id,
        siteId: sites.id,
        postId: posts.id,
        obligationType: reportingExceptions.obligationType,
        classification: reportingExceptions.classification,
        state: reportingExceptions.state,
        dueAt: reportingExceptions.dueAt,
        effectiveShiftEndAt: reportingExceptions.effectiveShiftEndAt,
        firstDetectedAt: reportingExceptions.firstDetectedAt,
        correctedAt: reportingExceptions.correctedAt,
        resolvedAt: reportingExceptions.resolvedAt,
        assigneeUserId: reportingExceptions.assigneeUserId,
        revision: reportingExceptions.revision,
      })
      .from(reportingExceptions)
      .innerJoin(
        shiftAssignments,
        eq(reportingExceptions.shiftAssignmentId, shiftAssignments.id),
      )
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id));
  }

  async list(
    scope: ReportingExceptionScope,
    options: { employeeId?: string; limit: number },
  ) {
    const rows = await this.base()
      .where(
        and(
          scopePredicate(scope),
          ...(options.employeeId
            ? [eq(shiftAssignments.employeeId, options.employeeId)]
            : []),
        ),
      )
      .orderBy(asc(reportingExceptions.dueAt), asc(reportingExceptions.id))
      .limit(options.limit);
    return rows.map(summary);
  }

  async detail(scope: ReportingExceptionScope, id: string) {
    const rows = await this.base()
      .where(and(scopePredicate(scope), eq(reportingExceptions.id, id)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const events = await this.database
      .select()
      .from(reportingExceptionEvents)
      .where(eq(reportingExceptionEvents.reportingExceptionId, id))
      .orderBy(
        asc(reportingExceptionEvents.occurredAt),
        asc(reportingExceptionEvents.id),
      );
    return {
      exception: summary(row),
      history: events.map((event): ReportingExceptionEvent => ({
        id: event.id,
        ...(event.previousState
          ? { previousState: event.previousState as ReportingExceptionState }
          : {}),
        nextState: event.nextState as ReportingExceptionState,
        reason: event.reason,
        actor: event.actorKind as "SYSTEM" | "USER",
        ...(event.actorUserId ? { actorUserId: event.actorUserId } : {}),
        ...(event.assigneeUserId
          ? { assigneeUserId: event.assigneeUserId }
          : {}),
        occurredAt: event.occurredAt.toISOString(),
      })),
    };
  }

  async dossier(scope: ReportingExceptionScope, id: string) {
    // Resolve the exception through the tenant/hierarchy predicate before any
    // assignment evidence is loaded. None of these reads reconcile obligations.
    const detail = await this.detail(scope, id);
    if (!detail) return null;
    const contextRows = await this.database
      .select({
        clientName: clients.name,
        siteName: sites.name,
        siteTimezone: sites.timezone,
        postName: posts.name,
        employeeNumber: employees.employeeNumber,
        employeeEmail: users.email,
        scheduledStart: shifts.scheduledStart,
        scheduledEnd: shifts.scheduledEnd,
        assignmentStatus: shiftAssignments.status,
      })
      .from(reportingExceptions)
      .innerJoin(
        shiftAssignments,
        eq(reportingExceptions.shiftAssignmentId, shiftAssignments.id),
      )
      .innerJoin(employees, eq(shiftAssignments.employeeId, employees.id))
      .leftJoin(users, eq(employees.userId, users.id))
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(and(scopePredicate(scope), eq(reportingExceptions.id, id)))
      .limit(1);
    const context = contextRows[0];
    if (!context) return null;
    const assignmentId = detail.exception.assignmentId;
    const [activities, incidents, closeouts, clockOuts] = await Promise.all([
      this.database
        .select({
          id: activityEntries.id,
          category: activityEntries.category,
          occurredAt: activityEntries.occurredAt,
          incidentGate: activityEntries.incidentGate,
        })
        .from(activityEntries)
        .where(
          and(
            eq(activityEntries.shiftAssignmentId, assignmentId),
            eq(activityEntries.status, "SUBMITTED"),
          ),
        )
        .orderBy(desc(activityEntries.occurredAt), desc(activityEntries.id))
        .limit(21),
      this.database
        .select({
          id: incidentReports.id,
          incidentNumber: incidentReports.incidentNumber,
          occurredAt: incidentReports.occurredAt,
          classification: incidentReports.classification,
          severity: incidentReports.severity,
        })
        .from(incidentReports)
        .where(
          and(
            eq(incidentReports.shiftAssignmentId, assignmentId),
            eq(incidentReports.status, "SUBMITTED"),
          ),
        )
        .orderBy(desc(incidentReports.occurredAt), desc(incidentReports.id))
        .limit(21),
      this.database
        .select({
          id: endOfShiftReports.id,
          submittedAt: endOfShiftReports.submittedAt,
        })
        .from(endOfShiftReports)
        .where(eq(endOfShiftReports.shiftAssignmentId, assignmentId))
        .limit(1),
      this.database
        .select({ effectiveAt: clockEvents.effectiveAt })
        .from(clockEvents)
        .where(
          and(
            eq(clockEvents.shiftAssignmentId, assignmentId),
            eq(clockEvents.eventType, "CLOCK_OUT"),
          ),
        )
        .orderBy(desc(clockEvents.effectiveAt), desc(clockEvents.id))
        .limit(1),
    ]);
    const actorIds = [
      ...new Set(
        [
          detail.exception.assigneeUserId,
          ...detail.history.flatMap((event) => [
            event.actorUserId,
            event.assigneeUserId,
          ]),
        ].filter((value): value is string => Boolean(value)),
      ),
    ];
    const actorRows = actorIds.length
      ? await this.database
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(
            and(
              eq(users.organizationId, scope.organizationId),
              inArray(users.id, actorIds),
            ),
          )
      : [];
    return {
      ...detail,
      context: {
        clientName: context.clientName,
        siteName: context.siteName,
        siteTimezone: context.siteTimezone,
        postName: context.postName,
        employeeNumber: context.employeeNumber,
        ...(context.employeeEmail
          ? { employeeEmail: context.employeeEmail }
          : {}),
        scheduledStart: context.scheduledStart.toISOString(),
        scheduledEnd: context.scheduledEnd.toISOString(),
        assignmentStatus: context.assignmentStatus,
      },
      evidence: {
        activities: activities.slice(0, 20).map((entry) => ({
          ...entry,
          occurredAt: entry.occurredAt.toISOString(),
        })),
        incidents: incidents.slice(0, 20).map((incident) => ({
          ...incident,
          occurredAt: incident.occurredAt.toISOString(),
        })),
        ...(closeouts[0]
          ? {
              closeout: {
                id: closeouts[0].id,
                submittedAt: closeouts[0].submittedAt.toISOString(),
              },
            }
          : {}),
        ...(clockOuts[0]
          ? { clockOutAt: clockOuts[0].effectiveAt.toISOString() }
          : {}),
        activityHasMore: activities.length > 20,
        incidentHasMore: incidents.length > 20,
      },
      actors: Object.fromEntries(actorRows.map((row) => [row.id, row.email])),
    };
  }

  async transition(
    scope: ReportingExceptionScope,
    input: ReportingExceptionTransition,
    audit: AuditContext,
  ) {
    const id = await this.database.transaction(async (tx) => {
      const locked = await tx.execute(sql`
        select re.id, re.state, re.revision, c.branch_id
        from reporting_exceptions re
        join shift_assignments sa on sa.id = re.shift_assignment_id
        join shifts sh on sh.id = sa.shift_id
        join posts p on p.id = sh.post_id
        join sites s on s.id = p.site_id
        join clients c on c.id = s.client_id
        where re.id=${input.exceptionId} and re.organization_id=${scope.organizationId}
        for update of re`);
      const current = locked.rows[0] as
        | { id: string; state: string; revision: number; branch_id: string }
        | undefined;
      if (!current) return null;
      if (current.revision !== input.expectedRevision)
        throw new Error(
          "This reporting exception changed. Refresh and try again.",
        );
      if (input.assigneeUserId) {
        const assignee = await tx
          .select({ id: users.id })
          .from(users)
          .innerJoin(employees, eq(employees.userId, users.id))
          .where(
            and(
              eq(users.id, input.assigneeUserId),
              eq(users.organizationId, scope.organizationId),
              eq(employees.employmentStatus, "active"),
              eq(employees.primaryBranchId, current.branch_id),
            ),
          )
          .limit(1);
        if (!assignee[0])
          throw new Error(
            "The assignee must be an active employee in the authorized branch.",
          );
      }
      const updated = await tx
        .update(reportingExceptions)
        .set({
          state: input.nextState,
          ...(input.assigneeUserId !== undefined
            ? { assigneeUserId: input.assigneeUserId }
            : {}),
          ...(input.nextState === "RESOLVED" ? { resolvedAt: new Date() } : {}),
          revision: current.revision + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(reportingExceptions.id, input.exceptionId),
            eq(reportingExceptions.revision, current.revision),
          ),
        )
        .returning({ id: reportingExceptions.id });
      if (!updated[0])
        throw new Error(
          "This reporting exception changed. Refresh and try again.",
        );
      await tx.insert(reportingExceptionEvents).values({
        reportingExceptionId: input.exceptionId,
        previousState: current.state,
        nextState: input.nextState,
        reason: input.reason.trim(),
        ...(input.assigneeUserId !== undefined
          ? { assigneeUserId: input.assigneeUserId }
          : {}),
        actorUserId: audit.actorUserId,
        actorKind: "USER",
        occurredAt: new Date(),
      });
      await tx.insert(auditEvents).values({
        organizationId: audit.organizationId,
        actorUserId: audit.actorUserId,
        action: `reporting-exception.${input.nextState.toLowerCase()}`,
        entityType: "ReportingException",
        entityId: input.exceptionId,
        occurredAt: new Date(),
        metadata: {
          previousState: current.state,
          nextState: input.nextState,
          reason: input.reason.trim(),
        },
        requestId: audit.requestId,
        ...(audit.sessionId ? { sessionId: audit.sessionId } : {}),
      });
      return input.exceptionId;
    });
    return id ? this.detail(scope, id) : null;
  }
}
