import "server-only";

import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import {
  auditEvents,
  branches,
  clients,
  employees,
  organizations,
} from "@/server/db/schema";
import type { NexusDatabase } from "@/server/db/client";
import type { AuditContext } from "@/server/request/boundary";
import type {
  BranchPage,
  BranchSummary,
  OrganizationSummary,
} from "./contracts";
import type {
  BranchMutation,
  OrganizationAdminRepository,
  OrganizationMutation,
} from "./repository";
import {
  DuplicateResourceError,
  InvariantViolationError,
  StaleUpdateError,
} from "@/server/request/errors";

const organizationProjection = {
  name: organizations.name,
  status: organizations.status,
  updatedAt: organizations.updatedAt,
};

const branchProjection = {
  id: branches.id,
  name: branches.name,
  timezone: branches.timezone,
  status: branches.status,
  updatedAt: branches.updatedAt,
};

function organizationDto(row: {
  name: string;
  status: string;
  updatedAt: Date;
}): OrganizationSummary {
  return {
    name: row.name,
    status: row.status === "inactive" ? "inactive" : "active",
    updatedAt: row.updatedAt.toISOString(),
  };
}

function branchDto(row: {
  id: string;
  name: string;
  timezone: string;
  status: string;
  updatedAt: Date;
}): BranchSummary {
  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    status: row.status === "inactive" ? "inactive" : "active",
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PostgresOrganizationAdminRepository implements OrganizationAdminRepository {
  constructor(private readonly database: NexusDatabase) {}

  async getOrganization(organizationId: string) {
    const rows = await this.database
      .select(organizationProjection)
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    return rows[0] ? organizationDto(rows[0]) : null;
  }

  async updateOrganization(
    organizationId: string,
    input: OrganizationMutation,
    expectedUpdatedAt: string,
    audit: AuditContext,
  ) {
    return this.database.transaction(async (transaction) => {
      const beforeRows = await transaction
        .select(organizationProjection)
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      const before = beforeRows[0];
      if (!before) return null;
      if (before.updatedAt.toISOString() !== expectedUpdatedAt) {
        throw new StaleUpdateError();
      }

      const updatedRows = await transaction
        .update(organizations)
        .set({ ...input, updatedAt: new Date() })
        .where(
          and(
            eq(organizations.id, organizationId),
            eq(organizations.updatedAt, new Date(expectedUpdatedAt)),
          ),
        )
        .returning(organizationProjection);
      const updated = updatedRows[0];
      if (!updated) throw new StaleUpdateError();

      await transaction.insert(auditEvents).values({
        organizationId,
        actorUserId: audit.actorUserId,
        action: "organization.updated",
        entityType: "Organization",
        entityId: organizationId,
        requestId: audit.requestId,
        sessionId: audit.sessionId,
        beforeState: organizationDto(before),
        afterState: organizationDto(updated),
      });
      return organizationDto(updated);
    });
  }

  async listBranches(
    organizationId: string,
    options: Parameters<OrganizationAdminRepository["listBranches"]>[1],
  ): Promise<BranchPage> {
    const cursorFilter = options.cursor
      ? or(
          gt(branches.name, options.cursor.name),
          and(
            eq(branches.name, options.cursor.name),
            gt(branches.id, options.cursor.id),
          ),
        )
      : undefined;
    const rows = await this.database
      .select(branchProjection)
      .from(branches)
      .where(and(eq(branches.organizationId, organizationId), cursorFilter))
      .orderBy(asc(branches.name), asc(branches.id))
      .limit(options.limit + 1);
    const hasMore = rows.length > options.limit;
    const items = rows.slice(0, options.limit).map(branchDto);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last ? { name: last.name, id: last.id } : undefined,
    };
  }

  async getBranch(organizationId: string, branchId: string) {
    const rows = await this.database
      .select(branchProjection)
      .from(branches)
      .where(
        and(
          eq(branches.organizationId, organizationId),
          eq(branches.id, branchId),
        ),
      )
      .limit(1);
    return rows[0] ? branchDto(rows[0]) : null;
  }

  async createBranch(
    organizationId: string,
    input: BranchMutation,
    audit: AuditContext,
  ) {
    return this.database.transaction(async (transaction) => {
      const guard = await transaction.execute(sql`
        select exists(
          select 1 from ${branches}
          where ${branches.organizationId} = ${organizationId}
            and lower(${branches.name}) = lower(${input.name})
            and ${branches.status} = 'active'
        ) as duplicate
        from ${organizations}
        where ${organizations.id} = ${organizationId}
        for update
      `);
      if (input.status === "active" && Boolean(guard.rows[0]?.duplicate)) {
        throw new DuplicateResourceError(
          "An active branch with this name already exists.",
        );
      }
      const rows = await transaction
        .insert(branches)
        .values({ organizationId, ...input })
        .returning(branchProjection);
      const created = rows[0];
      if (!created) throw new Error("Branch creation returned no record.");
      const result = branchDto(created);

      await transaction.insert(auditEvents).values({
        organizationId,
        actorUserId: audit.actorUserId,
        action: "branch.created",
        entityType: "Branch",
        entityId: created.id,
        requestId: audit.requestId,
        sessionId: audit.sessionId,
        afterState: result,
      });
      return result;
    });
  }

  async updateBranch(
    organizationId: string,
    branchId: string,
    input: BranchMutation,
    expectedUpdatedAt: string,
    audit: AuditContext,
  ) {
    return this.database.transaction(async (transaction) => {
      const beforeRows = await transaction
        .select(branchProjection)
        .from(branches)
        .where(
          and(
            eq(branches.organizationId, organizationId),
            eq(branches.id, branchId),
          ),
        )
        .limit(1);
      const before = beforeRows[0];
      if (!before) return null;
      if (before.updatedAt.toISOString() !== expectedUpdatedAt) {
        throw new StaleUpdateError();
      }

      const guard = await transaction.execute(sql`
        select
          exists(
            select 1 from ${branches}
            where ${branches.organizationId} = ${organizationId}
              and ${branches.id} <> ${branchId}
              and lower(${branches.name}) = lower(${input.name})
              and ${branches.status} = 'active'
          ) as duplicate,
          exists(
            select 1 from ${clients}
            where ${clients.branchId} = ${branchId}
              and ${clients.status} = 'active'
            union all
            select 1 from ${employees}
            where ${employees.primaryBranchId} = ${branchId}
              and ${employees.employmentStatus} = 'active'
          ) as active_dependencies
        from ${organizations}
        where ${organizations.id} = ${organizationId}
        for update
      `);
      if (input.status === "active" && Boolean(guard.rows[0]?.duplicate)) {
        throw new DuplicateResourceError(
          "An active branch with this name already exists.",
        );
      }
      if (
        input.status === "inactive" &&
        Boolean(guard.rows[0]?.active_dependencies)
      ) {
        throw new InvariantViolationError(
          "Reassign active clients and employees before deactivating this branch.",
        );
      }

      const updatedRows = await transaction
        .update(branches)
        .set({ ...input, updatedAt: new Date() })
        .where(
          and(
            eq(branches.organizationId, organizationId),
            eq(branches.id, branchId),
            eq(branches.updatedAt, new Date(expectedUpdatedAt)),
          ),
        )
        .returning(branchProjection);
      const updated = updatedRows[0];
      if (!updated) throw new StaleUpdateError();
      const result = branchDto(updated);

      await transaction.insert(auditEvents).values({
        organizationId,
        actorUserId: audit.actorUserId,
        action: "branch.updated",
        entityType: "Branch",
        entityId: branchId,
        requestId: audit.requestId,
        sessionId: audit.sessionId,
        beforeState: branchDto(before),
        afterState: result,
      });
      return result;
    });
  }
}
