import "server-only";

import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import {
  auditEvents,
  availability,
  certifications,
  clockEvents,
  clockEventCorrections,
  clients,
  credentials,
  employees,
  posts,
  operationalRecordRevisions,
  shiftAssignments,
  shifts,
  sites,
  timeRecords,
} from "@/server/db/schema";
import type { AuditContext } from "@/server/request/boundary";
import type { ShiftSummary } from "./contracts";
import type { AssignmentSummary, AvailabilitySummary } from "./contracts";
import type { ClockEventSummary } from "./contracts";
import type { ClockCorrectionSummary } from "./contracts";
import type {
  PostSchedulingScope,
  ClockContext,
  SchedulingRepository,
  SchedulingScope,
  ShiftMutation,
} from "./repository";

type Tx = Parameters<Parameters<NexusDatabase["transaction"]>[0]>[0];

function scopePredicate(scope: SchedulingScope) {
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

const projection = {
  id: shifts.id,
  organizationId: clients.organizationId,
  postId: shifts.postId,
  siteId: sites.id,
  clientId: clients.id,
  branchId: clients.branchId,
  postName: posts.name,
  siteName: sites.name,
  timezone: shifts.timezone,
  scheduledStart: shifts.scheduledStart,
  scheduledEnd: shifts.scheduledEnd,
  staffingRequirement: shifts.staffingRequirement,
  assignedCount: sql<number>`(
    select count(*)::int from ${shiftAssignments}
    where ${shiftAssignments.shiftId} = ${shifts.id}
      and ${shiftAssignments.status} in ('assigned', 'confirmed')
  )`,
  status: shifts.status,
  updatedAt: shifts.updatedAt,
};

function dto(row: {
  id: string;
  organizationId: string;
  postId: string;
  siteId: string;
  clientId: string;
  branchId: string | null;
  postName: string;
  siteName: string;
  timezone: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  staffingRequirement: number;
  assignedCount: number;
  status: string;
  updatedAt: Date;
}): ShiftSummary {
  return {
    ...row,
    branchId: row.branchId!,
    scheduledStart: row.scheduledStart.toISOString(),
    scheduledEnd: row.scheduledEnd.toISOString(),
    status: row.status as ShiftSummary["status"],
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function audit(
  tx: Tx,
  context: AuditContext,
  action: string,
  entityId: string,
  beforeState: object | undefined,
  afterState: object,
) {
  await tx.insert(auditEvents).values({
    organizationId: context.organizationId,
    actorUserId: context.actorUserId,
    action,
    entityType: "Shift",
    entityId,
    requestId: context.requestId,
    sessionId: context.sessionId,
    beforeState,
    afterState,
  });
}

export class PostgresSchedulingRepository implements SchedulingRepository {
  constructor(private readonly database: NexusDatabase) {}

  async getPostScope(
    scope: SchedulingScope,
    postId: string,
  ): Promise<PostSchedulingScope | null> {
    const rows = await this.database
      .select({
        organizationId: clients.organizationId,
        branchId: clients.branchId,
        clientId: clients.id,
        siteId: sites.id,
        postId: posts.id,
        timezone: sites.timezone,
        armedRequirement: posts.armedRequirement,
        qualificationRequirements: posts.qualificationRequirements,
      })
      .from(posts)
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(
        and(
          scopePredicate(scope),
          eq(posts.id, postId),
          eq(posts.active, true),
          eq(sites.active, true),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row?.branchId
      ? {
          ...row,
          branchId: row.branchId,
          armedRequirement: ["armed", "either"].includes(row.armedRequirement)
            ? (row.armedRequirement as "armed" | "either")
            : "unarmed",
          qualificationRequirements: Array.isArray(
            row.qualificationRequirements,
          )
            ? row.qualificationRequirements.filter(
                (value): value is string => typeof value === "string",
              )
            : [],
        }
      : null;
  }

  async listShifts(scope: SchedulingScope, limit: number) {
    const rows = await this.database
      .select(projection)
      .from(shifts)
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(scopePredicate(scope))
      .orderBy(asc(shifts.scheduledStart), asc(shifts.id))
      .limit(limit + 1);
    return {
      items: rows.slice(0, limit).map(dto),
      hasMore: rows.length > limit,
    };
  }

  async getShift(scope: SchedulingScope, shiftId: string) {
    const rows = await this.database
      .select(projection)
      .from(shifts)
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(and(scopePredicate(scope), eq(shifts.id, shiftId)))
      .limit(1);
    return rows[0] ? dto(rows[0]) : null;
  }

  async countActiveAssignments(scope: SchedulingScope, shiftId: string) {
    const rows = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(shiftAssignments)
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(
        and(
          scopePredicate(scope),
          eq(shifts.id, shiftId),
          inArray(shiftAssignments.status, ["assigned", "confirmed"]),
        ),
      );
    return rows[0]?.count ?? 0;
  }

  async createShift(
    scope: SchedulingScope,
    input: ShiftMutation,
    context: AuditContext,
  ) {
    const id = await this.database.transaction(async (tx) => {
      const inserted = await tx
        .insert(shifts)
        .values({
          postId: input.postId,
          timezone: input.timezone,
          scheduledStart: new Date(input.scheduledStart),
          scheduledEnd: new Date(input.scheduledEnd),
          staffingRequirement: input.staffingRequirement,
          status: input.status,
        })
        .returning({ id: shifts.id });
      const shiftId = inserted[0]!.id;
      await audit(tx, context, "shift.created", shiftId, undefined, input);
      return shiftId;
    });
    return (await this.getShift(scope, id))!;
  }

  async updateShift(
    scope: SchedulingScope,
    shiftId: string,
    input: ShiftMutation,
    expectedUpdatedAt: string,
    context: AuditContext,
  ) {
    const current = await this.getShift(scope, shiftId);
    if (!current) return null;
    const changed = await this.database.transaction(async (tx) => {
      const rows = await tx
        .update(shifts)
        .set({
          scheduledStart: new Date(input.scheduledStart),
          scheduledEnd: new Date(input.scheduledEnd),
          staffingRequirement: input.staffingRequirement,
          status: input.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(shifts.id, shiftId),
            eq(shifts.updatedAt, new Date(expectedUpdatedAt)),
          ),
        )
        .returning({ id: shifts.id });
      if (!rows[0]) return false;
      await audit(tx, context, "shift.updated", shiftId, current, input);
      return true;
    });
    return changed ? this.getShift(scope, shiftId) : null;
  }

  async listAvailability(
    scope: SchedulingScope,
    employeeId: string,
    limit: number,
  ) {
    const rows = await this.database
      .select({
        id: availability.id,
        employeeId: availability.employeeId,
        startsAt: availability.startsAt,
        endsAt: availability.endsAt,
        status: availability.status,
        updatedAt: availability.updatedAt,
      })
      .from(availability)
      .innerJoin(employees, eq(availability.employeeId, employees.id))
      .where(
        and(
          eq(employees.organizationId, scope.organizationId),
          eq(employees.id, employeeId),
        ),
      )
      .orderBy(asc(availability.startsAt), asc(availability.id))
      .limit(limit);
    return rows.map((row): AvailabilitySummary => ({
      ...row,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status as AvailabilitySummary["status"],
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async createAvailability(
    scope: SchedulingScope,
    employeeId: string,
    input: {
      startsAt: string;
      endsAt: string;
      status: "AVAILABLE" | "UNAVAILABLE";
    },
    context: AuditContext,
  ) {
    const employee = await this.database
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.organizationId, scope.organizationId),
        ),
      )
      .limit(1);
    if (!employee[0])
      throw new Error("Authoritative employee scope was not found.");
    const row = await this.database.transaction(async (tx) => {
      const inserted = await tx
        .insert(availability)
        .values({
          employeeId,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          status: input.status,
        })
        .returning();
      const created = inserted[0]!;
      await tx.insert(auditEvents).values({
        organizationId: context.organizationId,
        actorUserId: context.actorUserId,
        action: "availability.created",
        entityType: "Availability",
        entityId: created.id,
        requestId: context.requestId,
        sessionId: context.sessionId,
        afterState: input,
      });
      return created;
    });
    return {
      id: row.id,
      employeeId: row.employeeId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status as AvailabilitySummary["status"],
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getAssignmentCandidate(scope: SchedulingScope, employeeId: string) {
    const employeeQuery = this.database
      .select({
        organizationId: employees.organizationId,
        employeeId: employees.id,
        employeeNumber: employees.employeeNumber,
        employeeStatus: employees.employmentStatus,
      })
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.organizationId, scope.organizationId),
        ),
      )
      .limit(1);
    const credentialQuery = this.database
      .select()
      .from(credentials)
      .where(eq(credentials.employeeId, employeeId));
    const certificationQuery = this.database
      .select()
      .from(certifications)
      .where(eq(certifications.employeeId, employeeId));
    const availabilityQuery = this.listAvailability(scope, employeeId, 100);
    const [
      employeeRows,
      credentialRows,
      certificationRows,
      declaredAvailability,
    ] = await Promise.all([
      employeeQuery,
      credentialQuery,
      certificationQuery,
      availabilityQuery,
    ]);
    const employee = employeeRows[0];
    if (!employee) return null;
    const compliance = (
      row: (typeof credentialRows)[number],
      kind: "credential" | "certification",
    ) => ({
      id: row.id,
      employeeId: row.employeeId,
      kind,
      type: row.type,
      ...(kind === "credential" && "identifier" in row && row.identifier
        ? { identifier: row.identifier }
        : {}),
      issuingAuthority: row.issuingAuthority,
      issuedOn: row.issuedOn,
      ...(row.expiresOn ? { expiresOn: row.expiresOn } : {}),
      status: row.status as
        "active" | "expired" | "suspended" | "revoked" | "pending_verification",
      ...(row.documentReference
        ? { documentReference: row.documentReference }
        : {}),
      ...(row.predecessorId ? { predecessorId: row.predecessorId } : {}),
      ...(row.verifiedAt ? { verifiedAt: row.verifiedAt.toISOString() } : {}),
      updatedAt: row.updatedAt.toISOString(),
    });
    return {
      organizationId: employee.organizationId,
      employeeId: employee.employeeId,
      employeeNumber: employee.employeeNumber,
      employeeStatus:
        employee.employeeStatus === "active"
          ? ("active" as const)
          : ("inactive" as const),
      credentials: credentialRows.map((row) => compliance(row, "credential")),
      certifications: certificationRows.map((row) =>
        compliance(row as (typeof credentialRows)[number], "certification"),
      ),
      availability: declaredAvailability,
    };
  }

  async hasOverlappingAssignment(
    scope: SchedulingScope,
    employeeId: string,
    startsAt: string,
    endsAt: string,
  ) {
    const rows = await this.database
      .select({ id: shiftAssignments.id })
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
          lt(shifts.scheduledStart, new Date(endsAt)),
          sql`${shifts.scheduledEnd} > ${new Date(startsAt)}`,
        ),
      )
      .limit(1);
    return Boolean(rows[0]);
  }

  private async getAssignment(scope: SchedulingScope, assignmentId: string) {
    const rows = await this.listAssignments(scope, 100);
    return rows.find((row) => row.id === assignmentId) ?? null;
  }

  async createAssignment(
    scope: SchedulingScope,
    shiftId: string,
    employeeId: string,
    availabilityStatus: AssignmentSummary["availability"],
    warnings: readonly string[],
    context: AuditContext,
  ) {
    const id = await this.database.transaction(async (tx) => {
      const rows = await tx
        .insert(shiftAssignments)
        .values({
          shiftId,
          employeeId,
          status: "assigned",
          assignedAt: new Date(),
          availabilityStatus,
          warnings: [...warnings],
        })
        .returning({ id: shiftAssignments.id });
      const assignmentId = rows[0]!.id;
      await tx.insert(auditEvents).values({
        organizationId: context.organizationId,
        actorUserId: context.actorUserId,
        action: "shift-assignment.created",
        entityType: "ShiftAssignment",
        entityId: assignmentId,
        requestId: context.requestId,
        sessionId: context.sessionId,
        afterState: { shiftId, employeeId, availabilityStatus, warnings },
      });
      return assignmentId;
    });
    return (await this.getAssignment(scope, id))!;
  }

  async listAssignments(scope: SchedulingScope, limit: number) {
    const rows = await this.database
      .select({
        assignmentId: shiftAssignments.id,
        employeeId: shiftAssignments.employeeId,
        employeeNumber: employees.employeeNumber,
        assignmentStatus: shiftAssignments.status,
        availabilityStatus: shiftAssignments.availabilityStatus,
        warnings: shiftAssignments.warnings,
        assignedAt: shiftAssignments.assignedAt,
        assignmentUpdatedAt: shiftAssignments.updatedAt,
        ...projection,
      })
      .from(shiftAssignments)
      .innerJoin(employees, eq(shiftAssignments.employeeId, employees.id))
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(scopePredicate(scope))
      .orderBy(asc(shifts.scheduledStart), asc(shiftAssignments.id))
      .limit(limit);
    return rows.map((row): AssignmentSummary => {
      const shift = dto(row);
      return {
        id: row.assignmentId,
        organizationId: row.organizationId,
        shiftId: row.id,
        employeeId: row.employeeId,
        employeeNumber: row.employeeNumber,
        shift,
        status: row.assignmentStatus as AssignmentSummary["status"],
        availability:
          row.availabilityStatus as AssignmentSummary["availability"],
        warnings: Array.isArray(row.warnings)
          ? row.warnings.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
        assignedAt: row.assignedAt.toISOString(),
        updatedAt: row.assignmentUpdatedAt.toISOString(),
      };
    });
  }

  async getClockContext(scope: SchedulingScope, assignmentId: string) {
    const rows = await this.database
      .select({
        organizationId: clients.organizationId,
        branchId: clients.branchId,
        clientId: clients.id,
        siteId: sites.id,
        employeeId: shiftAssignments.employeeId,
        assignmentId: shiftAssignments.id,
        assignmentStatus: shiftAssignments.status,
        scheduledStart: shifts.scheduledStart,
        scheduledEnd: shifts.scheduledEnd,
        siteLatitude: sites.latitude,
        siteLongitude: sites.longitude,
        geofenceConfig: sites.geofenceConfig,
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
    const eventRows = await this.database
      .select()
      .from(clockEvents)
      .where(eq(clockEvents.shiftAssignmentId, assignmentId))
      .orderBy(asc(clockEvents.occurredAt), asc(clockEvents.id))
      .limit(100);
    const geofence =
      row.geofenceConfig && typeof row.geofenceConfig === "object"
        ? (row.geofenceConfig as Record<string, unknown>)
        : {};
    return {
      organizationId: row.organizationId,
      branchId: row.branchId,
      clientId: row.clientId,
      siteId: row.siteId,
      employeeId: row.employeeId,
      assignmentId: row.assignmentId,
      assignmentStatus: row.assignmentStatus as
        "assigned" | "confirmed" | "cancelled",
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledEnd: row.scheduledEnd.toISOString(),
      ...(row.siteLatitude === null
        ? {}
        : { siteLatitude: Number(row.siteLatitude) }),
      ...(row.siteLongitude === null
        ? {}
        : { siteLongitude: Number(row.siteLongitude) }),
      geofenceRadiusMeters:
        typeof geofence.radiusMeters === "number" ? geofence.radiusMeters : 150,
      events: eventRows.map(clockDto),
    };
  }

  async createClockEvent(
    _scope: SchedulingScope,
    context: ClockContext,
    event: Omit<ClockEventSummary, "id">,
    auditContext: AuditContext,
  ) {
    const row = await this.database.transaction(async (tx) => {
      const inserted = await tx
        .insert(clockEvents)
        .values({
          shiftAssignmentId: context.assignmentId,
          eventType: event.eventType,
          occurredAt: new Date(event.occurredAt),
          effectiveAt: new Date(event.effectiveAt),
          recordedByUserId: event.recordedByUserId,
          geolocation: event.locationEvidence,
          verificationStatus: event.verificationStatus,
          exceptionReason: event.exceptionReasons[0],
          exceptionReasons: [...event.exceptionReasons],
        })
        .returning();
      const created = inserted[0]!;
      await tx.insert(auditEvents).values({
        organizationId: auditContext.organizationId,
        actorUserId: auditContext.actorUserId,
        action: "clock-event.created",
        entityType: "ClockEvent",
        entityId: created.id,
        requestId: auditContext.requestId,
        sessionId: auditContext.sessionId,
        afterState: {
          shiftAssignmentId: context.assignmentId,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          verificationStatus: event.verificationStatus,
          exceptionReasons: event.exceptionReasons,
        },
      });
      return created;
    });
    return clockDto(row);
  }

  async getCorrectionContext(scope: SchedulingScope, clockEventId: string) {
    const rows = await this.database
      .select({
        event: clockEvents,
        organizationId: clients.organizationId,
        branchId: clients.branchId,
        clientId: clients.id,
        siteId: sites.id,
        employeeId: shiftAssignments.employeeId,
        assignmentId: shiftAssignments.id,
        assignmentStatus: shiftAssignments.status,
        scheduledStart: shifts.scheduledStart,
        scheduledEnd: shifts.scheduledEnd,
        siteLatitude: sites.latitude,
        siteLongitude: sites.longitude,
        geofenceConfig: sites.geofenceConfig,
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
      .where(and(scopePredicate(scope), eq(clockEvents.id, clockEventId)))
      .limit(1);
    const row = rows[0];
    if (!row?.branchId) return null;
    const correctionRows = await this.database
      .select()
      .from(clockEventCorrections)
      .where(eq(clockEventCorrections.clockEventId, clockEventId))
      .orderBy(
        asc(clockEventCorrections.revision),
        asc(clockEventCorrections.id),
      )
      .limit(100);
    const geofence =
      row.geofenceConfig && typeof row.geofenceConfig === "object"
        ? (row.geofenceConfig as Record<string, unknown>)
        : {};
    const event = clockDto(row.event);
    return {
      organizationId: row.organizationId,
      branchId: row.branchId,
      clientId: row.clientId,
      siteId: row.siteId,
      employeeId: row.employeeId,
      assignmentId: row.assignmentId,
      assignmentStatus: row.assignmentStatus as
        "assigned" | "confirmed" | "cancelled",
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledEnd: row.scheduledEnd.toISOString(),
      ...(row.siteLatitude === null
        ? {}
        : { siteLatitude: Number(row.siteLatitude) }),
      ...(row.siteLongitude === null
        ? {}
        : { siteLongitude: Number(row.siteLongitude) }),
      geofenceRadiusMeters:
        typeof geofence.radiusMeters === "number" ? geofence.radiusMeters : 150,
      events: [event],
      clockEvent: event,
      corrections: correctionRows.map(correctionDto),
    };
  }

  async appendClockCorrection(
    _scope: SchedulingScope,
    context: import("./repository").CorrectionContext,
    correction: Omit<ClockCorrectionSummary, "id" | "correctedAt">,
    correctedAt: string,
    auditContext: AuditContext,
  ) {
    const row = await this.database.transaction(async (tx) => {
      const inserted = await tx
        .insert(clockEventCorrections)
        .values({
          clockEventId: correction.clockEventId,
          revision: correction.revision,
          originalEffectiveAt: new Date(correction.originalEffectiveAt),
          correctedEffectiveAt: new Date(correction.correctedEffectiveAt),
          correctedByUserId: correction.correctedByUserId,
          correctedAt: new Date(correctedAt),
          reason: correction.reason,
        })
        .returning();
      const created = inserted[0]!;
      const auditRows = await tx
        .insert(auditEvents)
        .values({
          organizationId: auditContext.organizationId,
          actorUserId: auditContext.actorUserId,
          action: "clock-event.corrected",
          entityType: "ClockEvent",
          entityId: correction.clockEventId,
          requestId: auditContext.requestId,
          sessionId: auditContext.sessionId,
          beforeState: {
            effectiveAt: correction.originalEffectiveAt,
            revision: correction.revision - 1,
          },
          afterState: {
            effectiveAt: correction.correctedEffectiveAt,
            revision: correction.revision,
          },
          reason: correction.reason,
        })
        .returning({ id: auditEvents.id });
      await tx.insert(operationalRecordRevisions).values({
        organizationId: auditContext.organizationId,
        entityType: "ClockEvent",
        entityId: correction.clockEventId,
        revision: correction.revision,
        status: "AMENDED",
        snapshot: {
          originalEffectiveAt: correction.originalEffectiveAt,
          correctedEffectiveAt: correction.correctedEffectiveAt,
          reason: correction.reason,
        },
        changedByUserId: correction.correctedByUserId,
        changedAt: new Date(correctedAt),
        reason: correction.reason,
        auditEventId: auditRows[0]!.id,
      });
      await tx
        .update(timeRecords)
        .set({
          status: "AMENDED",
          approvedByUserId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(timeRecords.shiftAssignmentId, context.assignmentId),
            eq(timeRecords.status, "APPROVED"),
          ),
        );
      return created;
    });
    return correctionDto(row);
  }
}

function clockDto(row: typeof clockEvents.$inferSelect): ClockEventSummary {
  const geolocation =
    row.geolocation && typeof row.geolocation === "object"
      ? (row.geolocation as Record<string, unknown>)
      : undefined;
  const numeric = (key: string) =>
    typeof geolocation?.[key] === "number"
      ? (geolocation[key] as number)
      : undefined;
  const latitude = numeric("latitude");
  const longitude = numeric("longitude");
  const accuracyMeters = numeric("accuracyMeters");
  const distanceMeters = numeric("distanceMeters");
  return {
    id: row.id,
    shiftAssignmentId: row.shiftAssignmentId,
    eventType: row.eventType as ClockEventSummary["eventType"],
    occurredAt: row.occurredAt.toISOString(),
    effectiveAt: row.effectiveAt.toISOString(),
    verificationStatus:
      row.verificationStatus as ClockEventSummary["verificationStatus"],
    exceptionReasons: Array.isArray(row.exceptionReasons)
      ? row.exceptionReasons.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    ...(latitude === undefined ||
    longitude === undefined ||
    accuracyMeters === undefined
      ? {}
      : {
          locationEvidence: {
            latitude,
            longitude,
            accuracyMeters,
            ...(distanceMeters === undefined ? {} : { distanceMeters }),
          },
        }),
    recordedByUserId: row.recordedByUserId,
  };
}

function correctionDto(
  row: typeof clockEventCorrections.$inferSelect,
): ClockCorrectionSummary {
  return {
    id: row.id,
    clockEventId: row.clockEventId,
    revision: row.revision,
    originalEffectiveAt: row.originalEffectiveAt.toISOString(),
    correctedEffectiveAt: row.correctedEffectiveAt.toISOString(),
    correctedByUserId: row.correctedByUserId,
    correctedAt: row.correctedAt.toISOString(),
    reason: row.reason,
  };
}
