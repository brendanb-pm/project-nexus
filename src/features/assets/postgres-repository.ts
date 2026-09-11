import "server-only";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import { assets, auditEvents, clients, sites, users } from "@/server/db/schema";
import type { AuditContext } from "@/server/request/boundary";
import {
  DuplicateResourceError,
  StaleUpdateError,
} from "@/server/request/errors";
import { matchesUpdatedAt } from "@/server/db/optimistic-concurrency";
import type { AssetAuditEntry, AssetDetail, AssetSummary } from "./contracts";
import type {
  AssetMutation,
  AssetRepository,
  TrustedAssetScope,
} from "./repository";
type Tx = Parameters<Parameters<NexusDatabase["transaction"]>[0]>[0];
const projection = {
  id: assets.id,
  identifier: assets.identifier,
  assetType: assets.assetType,
  status: assets.status,
  condition: assets.condition,
  siteId: assets.assignedSiteId,
  siteName: sites.name,
  clientName: clients.name,
  inspectionDueOn: assets.inspectionDueOn,
  expiresOn: assets.expiresOn,
  updatedAt: assets.updatedAt,
};
type AssetRow = {
  id: string;
  identifier: string;
  assetType: string;
  status: string;
  condition: string;
  siteId: string | null;
  siteName: string | null;
  clientName: string | null;
  inspectionDueOn: string | null;
  expiresOn: string | null;
  updatedAt: Date;
};
function dto(row: AssetRow): AssetSummary {
  return {
    id: row.id,
    identifier: row.identifier,
    assetType: row.assetType as AssetSummary["assetType"],
    status: row.status as AssetSummary["status"],
    condition: row.condition as AssetSummary["condition"],
    ...(row.siteId
      ? {
          siteId: row.siteId,
          siteName: row.siteName ?? undefined,
          clientName: row.clientName ?? undefined,
        }
      : {}),
    ...(row.inspectionDueOn
      ? { inspectionDueOn: String(row.inspectionDueOn) }
      : {}),
    ...(row.expiresOn ? { expiresOn: String(row.expiresOn) } : {}),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function scopeWhere(scope: TrustedAssetScope) {
  if (scope.organizationWide)
    return eq(assets.organizationId, scope.organizationId);
  const filters = [
    scope.branchIds.length
      ? inArray(clients.branchId, [...scope.branchIds])
      : sql`false`,
    scope.clientIds.length
      ? inArray(clients.id, [...scope.clientIds])
      : sql`false`,
    scope.siteIds.length ? inArray(sites.id, [...scope.siteIds]) : sql`false`,
  ];
  return and(eq(assets.organizationId, scope.organizationId), or(...filters));
}
function siteWhere(scope: TrustedAssetScope) {
  if (scope.organizationWide)
    return eq(clients.organizationId, scope.organizationId);
  return and(
    eq(clients.organizationId, scope.organizationId),
    or(
      scope.branchIds.length
        ? inArray(clients.branchId, [...scope.branchIds])
        : sql`false`,
      scope.clientIds.length
        ? inArray(clients.id, [...scope.clientIds])
        : sql`false`,
      scope.siteIds.length ? inArray(sites.id, [...scope.siteIds]) : sql`false`,
    ),
  );
}
async function audit(
  tx: Tx,
  context: AuditContext,
  action: string,
  id: string,
  beforeState?: object,
  afterState?: object,
) {
  await tx.insert(auditEvents).values({
    organizationId: context.organizationId,
    actorUserId: context.actorUserId,
    action,
    entityType: "Asset",
    entityId: id,
    requestId: context.requestId,
    sessionId: context.sessionId,
    beforeState,
    afterState,
  });
}
export class PostgresAssetRepository implements AssetRepository {
  constructor(private readonly database: NexusDatabase) {}
  async list(scope: TrustedAssetScope) {
    const rows = await this.database
      .select(projection)
      .from(assets)
      .leftJoin(sites, eq(assets.assignedSiteId, sites.id))
      .leftJoin(clients, eq(sites.clientId, clients.id))
      .where(scopeWhere(scope))
      .orderBy(asc(assets.identifier), asc(assets.id))
      .limit(200);
    return rows.map(dto);
  }
  async listSites(scope: TrustedAssetScope) {
    const rows = await this.database
      .select({
        id: sites.id,
        name: sites.name,
        clientName: clients.name,
        branchId: clients.branchId,
      })
      .from(sites)
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(and(siteWhere(scope), eq(sites.active, true)))
      .orderBy(asc(clients.name), asc(sites.name), asc(sites.id))
      .limit(200);
    return rows.flatMap((r) =>
      r.branchId ? [{ ...r, branchId: r.branchId }] : [],
    );
  }
  async get(scope: TrustedAssetScope, id: string) {
    const rows = await this.database
      .select(projection)
      .from(assets)
      .leftJoin(sites, eq(assets.assignedSiteId, sites.id))
      .leftJoin(clients, eq(sites.clientId, clients.id))
      .where(and(scopeWhere(scope), eq(assets.id, id)))
      .limit(1);
    return rows[0] ? dto(rows[0]) : null;
  }
  async detail(
    scope: TrustedAssetScope,
    id: string,
  ): Promise<AssetDetail | null> {
    const asset = await this.get(scope, id);
    if (!asset) return null;
    const rows = await this.database
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        occurredAt: auditEvents.occurredAt,
        actor: users.email,
      })
      .from(auditEvents)
      .leftJoin(users, eq(auditEvents.actorUserId, users.id))
      .where(
        and(
          eq(auditEvents.organizationId, scope.organizationId),
          eq(auditEvents.entityType, "Asset"),
          eq(auditEvents.entityId, id),
        ),
      )
      .orderBy(asc(auditEvents.occurredAt))
      .limit(50);
    const audit = rows.map((r): AssetAuditEntry => ({
      id: r.id,
      action: r.action,
      occurredAt: r.occurredAt.toISOString(),
      actor: r.actor ?? "Authorized user",
    }));
    return { asset, audit };
  }
  async create(
    scope: TrustedAssetScope,
    input: AssetMutation,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const duplicate = await tx
        .select({ id: assets.id })
        .from(assets)
        .where(
          and(
            eq(assets.organizationId, scope.organizationId),
            sql`lower(${assets.identifier})=lower(${input.identifier})`,
          ),
        )
        .limit(1);
      if (duplicate[0])
        throw new DuplicateResourceError(
          "An asset with this identifier already exists in this organization.",
        );
      const rows = await tx
        .insert(assets)
        .values({
          organizationId: scope.organizationId,
          identifier: input.identifier,
          assetType: input.assetType,
          status: input.status,
          condition: input.condition,
          assignedSiteId: input.siteId,
          inspectionDueOn: input.inspectionDueOn,
          expiresOn: input.expiresOn,
        })
        .returning({ id: assets.id });
      const createdRows = await tx
        .select(projection)
        .from(assets)
        .leftJoin(sites, eq(assets.assignedSiteId, sites.id))
        .leftJoin(clients, eq(sites.clientId, clients.id))
        .where(and(scopeWhere(scope), eq(assets.id, rows[0]!.id)))
        .limit(1);
      const asset = createdRows[0] ? dto(createdRows[0]) : null;
      if (!asset) throw new Error("Created asset was unavailable.");
      await audit(tx, context, "asset.created", asset.id, undefined, asset);
      return asset;
    });
  }
  async update(
    scope: TrustedAssetScope,
    id: string,
    input: AssetMutation,
    expected: string,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const before = await this.get(scope, id);
      if (!before) return null;
      if (before.updatedAt !== expected) throw new StaleUpdateError();
      const duplicate = await tx
        .select({ id: assets.id })
        .from(assets)
        .where(
          and(
            eq(assets.organizationId, scope.organizationId),
            sql`lower(${assets.identifier})=lower(${input.identifier})`,
            sql`${assets.id}<>${id}`,
          ),
        )
        .limit(1);
      if (duplicate[0])
        throw new DuplicateResourceError(
          "An asset with this identifier already exists in this organization.",
        );
      const result = await tx
        .update(assets)
        .set({
          identifier: input.identifier,
          assetType: input.assetType,
          status: input.status,
          condition: input.condition,
          assignedSiteId: input.siteId,
          inspectionDueOn: input.inspectionDueOn,
          expiresOn: input.expiresOn,
          updatedAt: new Date(),
        })
        .where(
          and(eq(assets.id, id), matchesUpdatedAt(assets.updatedAt, expected)),
        )
        .returning({ id: assets.id });
      if (!result[0]) throw new StaleUpdateError();
      const updatedRows = await tx
        .select(projection)
        .from(assets)
        .leftJoin(sites, eq(assets.assignedSiteId, sites.id))
        .leftJoin(clients, eq(sites.clientId, clients.id))
        .where(and(scopeWhere(scope), eq(assets.id, id)))
        .limit(1);
      const updated = updatedRows[0] ? dto(updatedRows[0]) : null;
      if (!updated) throw new Error("Updated asset was unavailable.");
      await audit(tx, context, "asset.updated", id, before, updated);
      return updated;
    });
  }
}
