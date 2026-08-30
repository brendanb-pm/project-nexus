import "server-only";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import type { AuditContext } from "@/server/request/boundary";
import { matchesUpdatedAt } from "@/server/db/optimistic-concurrency";
import {
  assets,
  auditEvents,
  branches,
  clients,
  posts,
  shifts,
  sites,
} from "@/server/db/schema";
import {
  DuplicateResourceError,
  InvariantViolationError,
  StaleUpdateError,
} from "@/server/request/errors";
import type { PostSummary, SiteSummary } from "./contracts";
import {
  POST_LIMIT,
  type PostMutation,
  type SiteAdminRepository,
  type SiteMutation,
  type TrustedSiteScope,
} from "./repository";
type Tx = Parameters<Parameters<NexusDatabase["transaction"]>[0]>[0];
const siteProjection = {
  id: sites.id,
  clientId: sites.clientId,
  branchId: clients.branchId,
  clientName: clients.name,
  name: sites.name,
  address: sites.address,
  timezone: sites.timezone,
  latitude: sites.latitude,
  longitude: sites.longitude,
  geofenceConfig: sites.geofenceConfig,
  active: sites.active,
  updatedAt: sites.updatedAt,
};
const postProjection = {
  id: posts.id,
  siteId: posts.siteId,
  name: posts.name,
  description: posts.description,
  serviceType: posts.serviceType,
  armedRequirement: posts.armedRequirement,
  qualificationRequirements: posts.qualificationRequirements,
  active: posts.active,
  updatedAt: posts.updatedAt,
};
function siteDto(row: {
  id: string;
  clientId: string;
  branchId: string | null;
  clientName: string;
  name: string;
  address: unknown;
  timezone: string;
  latitude: string | null;
  longitude: string | null;
  geofenceConfig: unknown;
  active: boolean;
  updatedAt: Date;
}): SiteSummary {
  const address = (
    row.address && typeof row.address === "object" ? row.address : {}
  ) as Record<string, unknown>;
  const geofence = (
    row.geofenceConfig && typeof row.geofenceConfig === "object"
      ? row.geofenceConfig
      : {}
  ) as Record<string, unknown>;
  return {
    id: row.id,
    clientId: row.clientId,
    branchId: row.branchId!,
    clientName: row.clientName,
    name: row.name,
    addressLine1: String(address.line1 ?? ""),
    city: String(address.city ?? ""),
    region: String(address.region ?? ""),
    postalCode: String(address.postalCode ?? ""),
    country: String(address.country ?? "US"),
    timezone: row.timezone,
    latitude: row.latitude == null ? undefined : Number(row.latitude),
    longitude: row.longitude == null ? undefined : Number(row.longitude),
    geofenceRadiusMeters:
      typeof geofence.radiusMeters === "number"
        ? geofence.radiusMeters
        : undefined,
    status: row.active ? "active" : "inactive",
    updatedAt: row.updatedAt.toISOString(),
  };
}
function postDto(row: {
  id: string;
  siteId: string;
  name: string;
  description: string;
  serviceType: PostSummary["serviceType"];
  armedRequirement: string;
  qualificationRequirements: unknown;
  active: boolean;
  updatedAt: Date;
}): PostSummary {
  return {
    id: row.id,
    siteId: row.siteId,
    name: row.name,
    description: row.description,
    serviceType: row.serviceType,
    armedRequirement: ["armed", "either"].includes(row.armedRequirement)
      ? (row.armedRequirement as PostSummary["armedRequirement"])
      : "unarmed",
    qualificationRequirements: Array.isArray(row.qualificationRequirements)
      ? row.qualificationRequirements.filter(
          (v): v is string => typeof v === "string",
        )
      : [],
    status: row.active ? "active" : "inactive",
    updatedAt: row.updatedAt.toISOString(),
  };
}
function siteScope(scope: TrustedSiteScope) {
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
async function writeAudit(
  tx: Tx,
  context: AuditContext,
  action: string,
  entityType: string,
  entityId: string,
  beforeState?: object,
  afterState?: object,
) {
  await tx.insert(auditEvents).values({
    organizationId: context.organizationId,
    actorUserId: context.actorUserId,
    action,
    entityType,
    entityId,
    requestId: context.requestId,
    sessionId: context.sessionId,
    beforeState,
    afterState,
  });
}
export class PostgresSiteAdminRepository implements SiteAdminRepository {
  constructor(private readonly database: NexusDatabase) {}
  async listClients(scope: TrustedSiteScope) {
    const predicate = scope.organizationWide
      ? eq(clients.organizationId, scope.organizationId)
      : scope.branchIds.length || scope.clientIds.length
        ? and(
            eq(clients.organizationId, scope.organizationId),
            or(
              scope.branchIds.length
                ? inArray(clients.branchId, [...scope.branchIds])
                : sql`false`,
              scope.clientIds.length
                ? inArray(clients.id, [...scope.clientIds])
                : sql`false`,
            ),
          )
        : sql`false`;
    const rows = await this.database
      .select({
        id: clients.id,
        branchId: clients.branchId,
        name: clients.name,
        branchName: branches.name,
      })
      .from(clients)
      .innerJoin(branches, eq(clients.branchId, branches.id))
      .where(and(predicate, eq(clients.status, "active")))
      .orderBy(asc(clients.name), asc(clients.id))
      .limit(101);
    return rows.flatMap((row) =>
      row.branchId ? [{ ...row, branchId: row.branchId }] : [],
    );
  }
  async getClient(scope: TrustedSiteScope, clientId: string) {
    const rows = await this.database
      .select({
        id: clients.id,
        branchId: clients.branchId,
        name: clients.name,
        branchName: branches.name,
      })
      .from(clients)
      .innerJoin(branches, eq(clients.branchId, branches.id))
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.organizationId, scope.organizationId),
          scope.organizationWide
            ? undefined
            : or(
                scope.branchIds.length
                  ? inArray(clients.branchId, [...scope.branchIds])
                  : sql`false`,
                scope.clientIds.length
                  ? inArray(clients.id, [...scope.clientIds])
                  : sql`false`,
              ),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row?.branchId ? { ...row, branchId: row.branchId } : null;
  }
  async listSites(scope: TrustedSiteScope, limit: number) {
    const rows = await this.database
      .select(siteProjection)
      .from(sites)
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(siteScope(scope))
      .orderBy(asc(sites.name), asc(sites.id))
      .limit(limit + 1);
    return {
      items: rows.slice(0, limit).map(siteDto),
      hasMore: rows.length > limit,
    };
  }
  async getSite(scope: TrustedSiteScope, siteId: string) {
    const rows = await this.database
      .select(siteProjection)
      .from(sites)
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(and(siteScope(scope), eq(sites.id, siteId)))
      .limit(1);
    return rows[0] ? siteDto(rows[0]) : null;
  }
  async getSiteDetail(scope: TrustedSiteScope, siteId: string) {
    const site = await this.getSite(scope, siteId);
    if (!site) return null;
    const rows = await this.database
      .select(postProjection)
      .from(posts)
      .where(eq(posts.siteId, siteId))
      .orderBy(asc(posts.name), asc(posts.id))
      .limit(POST_LIMIT);
    return { site, posts: rows.map(postDto) };
  }
  async createSite(
    scope: TrustedSiteScope,
    input: SiteMutation,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const parent = await tx
        .select({
          id: clients.id,
          branchId: clients.branchId,
          name: clients.name,
        })
        .from(clients)
        .where(
          and(
            eq(clients.id, input.clientId),
            eq(clients.organizationId, scope.organizationId),
            eq(clients.status, "active"),
          ),
        )
        .limit(1);
      if (!parent[0])
        throw new InvariantViolationError(
          "Select an active authorized client.",
        );
      const duplicate = await tx
        .select({ id: sites.id })
        .from(sites)
        .where(
          and(
            eq(sites.clientId, input.clientId),
            sql`lower(${sites.name})=lower(${input.name})`,
            eq(sites.active, true),
          ),
        )
        .limit(1);
      if (input.status === "active" && duplicate[0])
        throw new DuplicateResourceError(
          "An active site with this name already exists for the client.",
        );
      const rows = await tx
        .insert(sites)
        .values({
          clientId: input.clientId,
          name: input.name,
          address: input.address,
          timezone: input.timezone,
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          geofenceConfig: input.geofenceRadiusMeters
            ? { radiusMeters: input.geofenceRadiusMeters }
            : {},
          active: input.status === "active",
        })
        .returning({
          id: sites.id,
          clientId: sites.clientId,
          name: sites.name,
          address: sites.address,
          timezone: sites.timezone,
          latitude: sites.latitude,
          longitude: sites.longitude,
          geofenceConfig: sites.geofenceConfig,
          active: sites.active,
          updatedAt: sites.updatedAt,
        });
      const created = rows[0]!;
      const result = siteDto({
        ...created,
        branchId: parent[0]!.branchId,
        clientName: parent[0]!.name,
      });
      await writeAudit(
        tx,
        context,
        "site.created",
        "Site",
        result.id,
        undefined,
        result,
      );
      return result;
    });
  }
  async updateSite(
    scope: TrustedSiteScope,
    siteId: string,
    input: SiteMutation,
    expected: string,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const beforeRows = await tx
        .select(siteProjection)
        .from(sites)
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(
          and(
            siteScope(scope),
            eq(sites.id, siteId),
            eq(sites.clientId, input.clientId),
          ),
        )
        .limit(1);
      const before = beforeRows[0];
      if (!before) return null;
      if (before.updatedAt.toISOString() !== expected)
        throw new StaleUpdateError();
      const guard = await tx.execute(
        sql`select exists(select 1 from ${sites} where ${sites.clientId}=${input.clientId} and ${sites.id}<>${siteId} and lower(${sites.name})=lower(${input.name}) and ${sites.active}=true) duplicate, exists(select 1 from ${posts} where ${posts.siteId}=${siteId} and ${posts.active}=true union all select 1 from ${assets} where ${assets.assignedSiteId}=${siteId} and ${assets.status}='active' union all select 1 from ${shifts} join ${posts} p on p.id=${shifts.postId} where p.site_id=${siteId} and ${shifts.scheduledEnd}>=now() and ${shifts.status} not in ('completed','cancelled')) active_dependencies`,
      );
      if (input.status === "active" && Boolean(guard.rows[0]?.duplicate))
        throw new DuplicateResourceError(
          "An active site with this name already exists for the client.",
        );
      if (
        input.status === "inactive" &&
        Boolean(guard.rows[0]?.active_dependencies)
      )
        throw new InvariantViolationError(
          "Deactivate active posts, future shifts, and assigned assets before deactivating this site.",
        );
      const rows = await tx
        .update(sites)
        .set({
          name: input.name,
          address: input.address,
          timezone: input.timezone,
          latitude: input.latitude?.toString() ?? null,
          longitude: input.longitude?.toString() ?? null,
          geofenceConfig: input.geofenceRadiusMeters
            ? { radiusMeters: input.geofenceRadiusMeters }
            : {},
          active: input.status === "active",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sites.id, siteId),
            eq(sites.clientId, input.clientId),
            matchesUpdatedAt(sites.updatedAt, expected),
          ),
        )
        .returning({
          id: sites.id,
          clientId: sites.clientId,
          name: sites.name,
          address: sites.address,
          timezone: sites.timezone,
          latitude: sites.latitude,
          longitude: sites.longitude,
          geofenceConfig: sites.geofenceConfig,
          active: sites.active,
          updatedAt: sites.updatedAt,
        });
      if (!rows[0]) throw new StaleUpdateError();
      const result = siteDto({
        ...rows[0],
        branchId: before.branchId,
        clientName: before.clientName,
      });
      await writeAudit(
        tx,
        context,
        "site.updated",
        "Site",
        siteId,
        siteDto(before),
        result,
      );
      return result;
    });
  }
  async createPost(
    scope: TrustedSiteScope,
    input: PostMutation,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const site = await tx
        .select({ id: sites.id, active: sites.active })
        .from(sites)
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(and(siteScope(scope), eq(sites.id, input.siteId)))
        .limit(1);
      if (!site[0]?.active)
        throw new InvariantViolationError("Select an active authorized site.");
      const duplicate = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(
          and(
            eq(posts.siteId, input.siteId),
            sql`lower(${posts.name})=lower(${input.name})`,
            eq(posts.active, true),
          ),
        )
        .limit(1);
      if (input.status === "active" && duplicate[0])
        throw new DuplicateResourceError(
          "An active post with this name already exists at the site.",
        );
      const rows = await tx
        .insert(posts)
        .values({
          siteId: input.siteId,
          name: input.name,
          description: input.description,
          serviceType: input.serviceType,
          armedRequirement: input.armedRequirement,
          qualificationRequirements: input.qualificationRequirements,
          active: input.status === "active",
        })
        .returning(postProjection);
      const result = postDto(rows[0]!);
      await writeAudit(
        tx,
        context,
        "post.created",
        "Post",
        result.id,
        undefined,
        result,
      );
      return result;
    });
  }
  async updatePost(
    scope: TrustedSiteScope,
    postId: string,
    input: PostMutation,
    expected: string,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const rows = await tx
        .select(postProjection)
        .from(posts)
        .innerJoin(sites, eq(posts.siteId, sites.id))
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(
          and(
            siteScope(scope),
            eq(posts.id, postId),
            eq(posts.siteId, input.siteId),
          ),
        )
        .limit(1);
      const before = rows[0];
      if (!before) return null;
      if (before.updatedAt.toISOString() !== expected)
        throw new StaleUpdateError();
      const guard = await tx.execute(
        sql`select exists(select 1 from ${posts} where ${posts.siteId}=${input.siteId} and ${posts.id}<>${postId} and lower(${posts.name})=lower(${input.name}) and ${posts.active}=true) duplicate, exists(select 1 from ${shifts} where ${shifts.postId}=${postId} and ${shifts.scheduledEnd}>=now() and ${shifts.status} not in ('completed','cancelled')) active_dependencies`,
      );
      if (input.status === "active" && Boolean(guard.rows[0]?.duplicate))
        throw new DuplicateResourceError(
          "An active post with this name already exists at the site.",
        );
      if (
        input.status === "inactive" &&
        Boolean(guard.rows[0]?.active_dependencies)
      )
        throw new InvariantViolationError(
          "Resolve future or active shifts before deactivating this post.",
        );
      const updated = await tx
        .update(posts)
        .set({
          name: input.name,
          description: input.description,
          serviceType: input.serviceType,
          armedRequirement: input.armedRequirement,
          qualificationRequirements: input.qualificationRequirements,
          active: input.status === "active",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(posts.id, postId),
            eq(posts.siteId, input.siteId),
            matchesUpdatedAt(posts.updatedAt, expected),
          ),
        )
        .returning(postProjection);
      if (!updated[0]) throw new StaleUpdateError();
      const result = postDto(updated[0]);
      await writeAudit(
        tx,
        context,
        "post.updated",
        "Post",
        postId,
        postDto(before),
        result,
      );
      return result;
    });
  }
}
