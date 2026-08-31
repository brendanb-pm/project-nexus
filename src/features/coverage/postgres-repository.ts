import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import { auditEvents, clients, coverageRequirements, posts, shiftAssignments, shifts, sites } from "@/server/db/schema";
import type { SchedulingScope } from "@/features/scheduling/repository";
import type { CoverageRepository } from "./repository";
import type { CoverageGap, CoverageRequirement } from "./contracts";

const scopePredicate = (scope: SchedulingScope) => and(
  eq(clients.organizationId, scope.organizationId),
  scope.organizationWide || !scope.branchIds.length ? undefined : sql`${clients.branchId} in ${scope.branchIds}`,
  scope.organizationWide || !scope.clientIds.length ? undefined : sql`${clients.id} in ${scope.clientIds}`,
  scope.organizationWide || !scope.siteIds.length ? undefined : sql`${sites.id} in ${scope.siteIds}`,
);

export class PostgresCoverageRepository implements CoverageRepository {
  constructor(private readonly database: NexusDatabase) {}
  async getPostScope(scope: SchedulingScope, postId: string) {
    const rows = await this.database.select({ organizationId: clients.organizationId, postId: posts.id, siteId: sites.id, clientId: clients.id, branchId: clients.branchId, timezone: sites.timezone }).from(posts).innerJoin(sites, eq(posts.siteId, sites.id)).innerJoin(clients, eq(sites.clientId, clients.id)).where(and(scopePredicate(scope), eq(posts.id, postId))).limit(1);
    const row = rows[0];
    return row ? { ...row, branchId: row.branchId ?? "" } : null;
  }
  async listRequirements(scope: SchedulingScope, limit: number) {
    const rows = await this.database.select({ requirement: coverageRequirements, siteId: sites.id, clientId: clients.id, branchId: clients.branchId, timezone: sites.timezone }).from(coverageRequirements).innerJoin(posts, eq(coverageRequirements.postId, posts.id)).innerJoin(sites, eq(posts.siteId, sites.id)).innerJoin(clients, eq(sites.clientId, clients.id)).where(scopePredicate(scope)).orderBy(asc(coverageRequirements.effectiveStart), asc(coverageRequirements.id)).limit(limit);
    return rows.map((row) => dto(row.requirement, row));
  }
  async createRequirement(scope: SchedulingScope, input: Parameters<CoverageRepository["createRequirement"]>[1], audit: Parameters<CoverageRepository["createRequirement"]>[2]) {
    const visible = await this.database.select({ id: posts.id }).from(posts).innerJoin(sites, eq(posts.siteId, sites.id)).innerJoin(clients, eq(sites.clientId, clients.id)).where(and(scopePredicate(scope), eq(posts.id, input.postId))).limit(1);
    if (!visible[0]) throw new Error("Post is outside the authorized scope.");
    const requirement = await this.database.transaction(async (tx) => {
      const inserted = await tx.insert(coverageRequirements).values({ ...input, weekdays: [...input.weekdays] }).returning();
      const row = inserted[0]!;
      await tx.insert(auditEvents).values({ organizationId: audit.organizationId, actorUserId: audit.actorUserId, action: "coverage-requirement.created", entityType: "CoverageRequirement", entityId: row.id, requestId: audit.requestId, sessionId: audit.sessionId, afterState: input });
      return row;
    });
    const rows = await this.listRequirements(scope, 100);
    return rows.find((row) => row.id === requirement.id)!;
  }
  async listGaps(scope: SchedulingScope, startsAt: string, endsAt: string, limit: number) {
    const requirements = await this.listRequirements(scope, 100);
    const active = requirements.filter((item) => item.active && item.effectiveStart <= endsAt.slice(0, 10) && (!item.effectiveEnd || item.effectiveEnd >= startsAt.slice(0, 10)));
    const counts = await this.database.select({ postId: shifts.postId, count: sql<number>`count(${shiftAssignments.id})` }).from(shifts).leftJoin(shiftAssignments, and(eq(shiftAssignments.shiftId, shifts.id), sql`${shiftAssignments.status} in ('assigned', 'confirmed')`)).innerJoin(posts, eq(shifts.postId, posts.id)).innerJoin(sites, eq(posts.siteId, sites.id)).innerJoin(clients, eq(sites.clientId, clients.id)).where(and(scopePredicate(scope), lte(shifts.scheduledStart, new Date(endsAt)), gte(shifts.scheduledEnd, new Date(startsAt)))).groupBy(shifts.postId);
    const byPost = new Map(counts.map((item) => [item.postId, Number(item.count)]));
    return active.map((item): CoverageGap => ({ requirementId: item.id, postId: item.postId, startsAt, endsAt, requiredCount: item.requiredCount, scheduledCount: byPost.get(item.postId) ?? 0, uncoveredCount: Math.max(0, item.requiredCount - (byPost.get(item.postId) ?? 0)) })).filter((item) => item.uncoveredCount > 0).slice(0, limit);
  }
}

function dto(row: typeof coverageRequirements.$inferSelect, context: { siteId: string; clientId: string; branchId: string | null; timezone: string }): CoverageRequirement {
  return { id: row.id, postId: row.postId, siteId: context.siteId, clientId: context.clientId, branchId: context.branchId ?? "", timezone: context.timezone, requiredCount: row.requiredCount, weekdays: Array.isArray(row.weekdays) ? row.weekdays.filter((value): value is CoverageRequirement["weekdays"][number] => typeof value === "string") : [], localStartTime: row.localStartTime, localEndTime: row.localEndTime, effectiveStart: row.effectiveStart, ...(row.effectiveEnd ? { effectiveEnd: row.effectiveEnd } : {}), active: row.active, updatedAt: row.updatedAt.toISOString() };
}
