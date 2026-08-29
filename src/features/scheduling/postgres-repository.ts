import "server-only";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import {
  auditEvents,
  clients,
  posts,
  shiftAssignments,
  shifts,
  sites,
} from "@/server/db/schema";
import type { AuditContext } from "@/server/request/boundary";
import type { ShiftSummary } from "./contracts";
import type {
  PostSchedulingScope,
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
    return row?.branchId ? { ...row, branchId: row.branchId } : null;
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
}
