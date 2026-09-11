import "server-only";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { NexusDatabase } from "@/server/db/client";
import {
  assetCheckoutEvents,
  assets,
  auditEvents,
  clients,
  employees,
  sites,
  users,
} from "@/server/db/schema";
import type { AuditContext } from "@/server/request/boundary";
import {
  DuplicateResourceError,
  StaleUpdateError,
} from "@/server/request/errors";
import { matchesUpdatedAt } from "@/server/db/optimistic-concurrency";
import type {
  AssetAuditEntry,
  AssetCustodyEvent,
  AssetDetail,
  AssetSummary,
} from "./contracts";
import type {
  AssetMutation,
  CustodyMutation,
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
function employeeWhere(scope: TrustedAssetScope) {
  if (scope.organizationWide)
    return eq(employees.organizationId, scope.organizationId);
  return and(
    eq(employees.organizationId, scope.organizationId),
    scope.branchIds.length
      ? inArray(employees.primaryBranchId, [...scope.branchIds])
      : sql`false`,
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
  async listEmployees(scope: TrustedAssetScope) {
    const rows = await this.database
      .select({
        id: employees.id,
        profile: employees.profile,
        branchId: employees.primaryBranchId,
      })
      .from(employees)
      .where(
        and(employeeWhere(scope), eq(employees.employmentStatus, "active")),
      )
      .orderBy(asc(employees.employeeNumber), asc(employees.id))
      .limit(200);
    return rows.flatMap((row) =>
      row.branchId
        ? [
            {
              id: row.id,
              displayName: String(
                (row.profile as Record<string, unknown> | null)?.name ??
                  "Employee",
              ),
              branchId: row.branchId,
            },
          ]
        : [],
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
    const priorEmployees = alias(employees, "asset_custody_prior_employees");
    const nextEmployees = alias(employees, "asset_custody_next_employees");
    const priorSites = alias(sites, "asset_custody_prior_sites");
    const nextSites = alias(sites, "asset_custody_next_sites");
    const actors = alias(users, "asset_custody_actors");
    const custodyRows = await this.database
      .select({
        id: assetCheckoutEvents.id,
        action: assetCheckoutEvents.eventType,
        occurredAt: assetCheckoutEvents.occurredAt,
        reason: assetCheckoutEvents.reason,
        condition: assetCheckoutEvents.condition,
        fromEmployee: priorEmployees.profile,
        fromSite: priorSites.name,
        toEmployee: nextEmployees.profile,
        toSite: nextSites.name,
        actor: actors.email,
      })
      .from(assetCheckoutEvents)
      .leftJoin(
        priorEmployees,
        eq(assetCheckoutEvents.previousEmployeeId, priorEmployees.id),
      )
      .leftJoin(
        priorSites,
        eq(assetCheckoutEvents.previousSiteId, priorSites.id),
      )
      .leftJoin(
        nextEmployees,
        eq(assetCheckoutEvents.employeeId, nextEmployees.id),
      )
      .leftJoin(nextSites, eq(assetCheckoutEvents.siteId, nextSites.id))
      .leftJoin(actors, eq(assetCheckoutEvents.actorUserId, actors.id))
      .where(eq(assetCheckoutEvents.assetId, id))
      .orderBy(asc(assetCheckoutEvents.occurredAt), asc(assetCheckoutEvents.id))
      .limit(100);
    const custody = custodyRows.map((row): AssetCustodyEvent => ({
      id: row.id,
      action: row.action as AssetCustodyEvent["action"],
      occurredAt: row.occurredAt.toISOString(),
      ...(row.fromEmployee
        ? {
            fromEmployee: String(
              (row.fromEmployee as Record<string, unknown>).name ?? "Employee",
            ),
          }
        : {}),
      ...(row.fromSite ? { fromSite: row.fromSite } : {}),
      ...(row.toEmployee
        ? {
            toEmployee: String(
              (row.toEmployee as Record<string, unknown>).name ?? "Employee",
            ),
          }
        : {}),
      ...(row.toSite ? { toSite: row.toSite } : {}),
      actor: row.actor ?? "Authorized user",
      reason: row.reason,
      ...(row.condition
        ? { condition: row.condition as AssetSummary["condition"] }
        : {}),
    }));
    return { asset, audit, custody };
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
  async custody(
    scope: TrustedAssetScope,
    assetId: string,
    input: CustodyMutation,
    expected: string,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`select id, assigned_employee_id, assigned_site_id, status, condition, updated_at from assets where id=${assetId} and organization_id=${scope.organizationId} for update`,
      );
      const current = locked.rows[0] as
        | {
            assigned_employee_id: string | null;
            assigned_site_id: string | null;
            status: string;
            condition: string;
            updated_at: Date | string;
          }
        | undefined;
      if (!current) return null;
      if (new Date(current.updated_at).toISOString() !== expected)
        throw new StaleUpdateError();
      if (["inactive", "retired"].includes(current.status))
        throw new Error("This asset is not available for custody changes.");
      if (
        (input.action === "CHECKOUT" && current.assigned_employee_id) ||
        (input.action === "TRANSFER" && !current.assigned_employee_id) ||
        (input.action === "CHECKIN" && !current.assigned_employee_id)
      )
        throw new Error(
          "The asset custody state changed. Refresh and try again.",
        );
      if (input.employeeId) {
        const employee = await tx
          .select({ id: employees.id })
          .from(employees)
          .where(
            and(
              eq(employees.id, input.employeeId),
              employeeWhere(scope),
              eq(employees.employmentStatus, "active"),
            ),
          )
          .limit(1);
        if (!employee[0])
          throw new Error("Select an active employee in this organization.");
      }
      if (input.siteId) {
        const site = await tx
          .select({ id: sites.id })
          .from(sites)
          .innerJoin(clients, eq(sites.clientId, clients.id))
          .where(
            and(
              eq(sites.id, input.siteId),
              siteWhere(scope),
              eq(sites.active, true),
            ),
          )
          .limit(1);
        if (!site[0]) throw new Error("Select an authorized return site.");
      }
      const nextEmployee =
        input.action === "CHECKIN" ? null : input.employeeId!;
      const nextSite =
        input.action === "CHECKOUT" || input.action === "TRANSFER"
          ? null
          : input.siteId!;
      await tx.insert(assetCheckoutEvents).values({
        assetId,
        employeeId: nextEmployee,
        siteId: nextSite,
        previousEmployeeId: current.assigned_employee_id,
        previousSiteId: current.assigned_site_id,
        eventType: input.action,
        reason: input.reason,
        condition: input.condition ?? current.condition,
        occurredAt: new Date(),
        actorUserId: context.actorUserId,
      });
      const update = await tx
        .update(assets)
        .set({
          assignedEmployeeId: nextEmployee,
          assignedSiteId: nextSite,
          condition: input.condition ?? current.condition,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(assets.id, assetId),
            matchesUpdatedAt(assets.updatedAt, expected),
          ),
        )
        .returning({ id: assets.id });
      if (!update[0]) throw new StaleUpdateError();
      const rows = await tx
        .select(projection)
        .from(assets)
        .leftJoin(sites, eq(assets.assignedSiteId, sites.id))
        .leftJoin(clients, eq(sites.clientId, clients.id))
        .where(eq(assets.id, assetId))
        .limit(1);
      const result = rows[0] ? dto(rows[0]) : null;
      if (!result) throw new Error("Custody projection unavailable.");
      await audit(
        tx,
        context,
        `asset.custody.${input.action.toLowerCase()}`,
        assetId,
        {
          employeeId: current.assigned_employee_id,
          siteId: current.assigned_site_id,
        },
        { employeeId: nextEmployee, siteId: nextSite, reason: input.reason },
      );
      return result;
    });
  }
}
