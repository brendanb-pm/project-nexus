import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { auditEvents, branches, employees, users } from "@/server/db/schema";
import type { NexusDatabase } from "@/server/db/client";
import type { AuditContext } from "@/server/request/boundary";
import {
  DuplicateResourceError,
  InvariantViolationError,
  StaleUpdateError,
} from "@/server/request/errors";
import type { EmployeeSummary } from "./contracts";
import {
  EMPLOYEE_PAGE_SIZE,
  USER_OPTION_LIMIT,
  type EmployeeMutation,
  type PeopleAdminRepository,
  type TrustedEmployeeScope,
} from "./repository";

const employeeProjection = {
  id: employees.id,
  employeeNumber: employees.employeeNumber,
  profile: employees.profile,
  employmentStatus: employees.employmentStatus,
  primaryBranchId: employees.primaryBranchId,
  primaryBranchName: branches.name,
  userId: users.id,
  userEmail: users.email,
  userStatus: users.status,
  updatedAt: employees.updatedAt,
};
type EmployeeRow = {
  id: string;
  employeeNumber: string;
  profile: unknown;
  employmentStatus: string;
  primaryBranchId: string;
  primaryBranchName: string;
  userId: string | null;
  userEmail: string | null;
  userStatus: string | null;
  updatedAt: Date;
};
function dto(row: EmployeeRow): EmployeeSummary {
  const profile =
    typeof row.profile === "object" && row.profile
      ? (row.profile as Record<string, unknown>)
      : {};
  const displayName =
    typeof profile.displayName === "string"
      ? profile.displayName
      : row.employeeNumber;
  const workPhone =
    typeof profile.workPhone === "string" ? profile.workPhone : undefined;
  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    displayName,
    workPhone,
    employmentStatus:
      row.employmentStatus === "inactive" ? "inactive" : "active",
    primaryBranchId: row.primaryBranchId,
    primaryBranchName: row.primaryBranchName,
    user:
      row.userId && row.userEmail && row.userStatus
        ? {
            id: row.userId,
            email: row.userEmail,
            status: row.userStatus === "inactive" ? "inactive" : "active",
          }
        : undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}
function scopeCondition(scope: TrustedEmployeeScope) {
  return scope.organizationWide
    ? eq(employees.organizationId, scope.organizationId)
    : and(
        eq(employees.organizationId, scope.organizationId),
        scope.branchIds.length
          ? inArray(employees.primaryBranchId, [...scope.branchIds])
          : sql`false`,
      );
}
async function writeAudit(
  tx: Parameters<Parameters<NexusDatabase["transaction"]>[0]>[0],
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
    entityType: "Employee",
    entityId: id,
    requestId: context.requestId,
    sessionId: context.sessionId,
    beforeState,
    afterState,
  });
}
export class PostgresPeopleAdminRepository implements PeopleAdminRepository {
  constructor(private readonly database: NexusDatabase) {}
  async listBranches(scope: TrustedEmployeeScope) {
    const condition = scope.organizationWide
      ? eq(branches.organizationId, scope.organizationId)
      : scope.branchIds.length
        ? and(
            eq(branches.organizationId, scope.organizationId),
            inArray(branches.id, [...scope.branchIds]),
          )
        : sql`false`;
    return this.database
      .select({
        id: branches.id,
        name: branches.name,
        timezone: branches.timezone,
      })
      .from(branches)
      .where(and(condition, eq(branches.status, "active")))
      .orderBy(asc(branches.name), asc(branches.id))
      .limit(USER_OPTION_LIMIT);
  }
  async listEmployees(scope: TrustedEmployeeScope, limit: number) {
    const rows = await this.database
      .select(employeeProjection)
      .from(employees)
      .innerJoin(branches, eq(branches.id, employees.primaryBranchId))
      .leftJoin(users, eq(users.id, employees.userId))
      .where(scopeCondition(scope))
      .orderBy(asc(employees.employeeNumber), asc(employees.id))
      .limit(limit + 1);
    return {
      items: rows.slice(0, limit).map(dto),
      hasMore: rows.length > limit,
    };
  }
  async listLinkableUsers(scope: TrustedEmployeeScope) {
    return this.database
      .select({ id: users.id, email: users.email, status: users.status })
      .from(users)
      .where(
        and(
          eq(users.organizationId, scope.organizationId),
          sql`not exists (select 1 from ${employees} where ${employees.userId} = ${users.id})`,
        ),
      )
      .orderBy(asc(users.email), asc(users.id))
      .limit(USER_OPTION_LIMIT)
      .then((rows) =>
        rows.map((row) => ({
          ...row,
          status:
            row.status === "inactive"
              ? ("inactive" as const)
              : ("active" as const),
        })),
      );
  }
  async getEmployee(scope: TrustedEmployeeScope, id: string) {
    const rows = await this.database
      .select(employeeProjection)
      .from(employees)
      .innerJoin(branches, eq(branches.id, employees.primaryBranchId))
      .leftJoin(users, eq(users.id, employees.userId))
      .where(and(scopeCondition(scope), eq(employees.id, id)))
      .limit(1);
    return rows[0] ? dto(rows[0]) : null;
  }
  private async assertParentAndUser(
    tx: Parameters<Parameters<NexusDatabase["transaction"]>[0]>[0],
    scope: TrustedEmployeeScope,
    input: EmployeeMutation,
    exceptId?: string,
  ) {
    const branch = await tx
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(
        and(
          eq(branches.id, input.primaryBranchId),
          eq(branches.organizationId, scope.organizationId),
          eq(branches.status, "active"),
        ),
      )
      .limit(1);
    if (!branch[0])
      throw new InvariantViolationError(
        "Select an active authorized primary branch.",
      );
    let linkedUser: { id: string; email: string; status: string } | undefined;
    if (input.userId) {
      const userRows = await tx
        .select({ id: users.id, email: users.email, status: users.status })
        .from(users)
        .where(
          and(
            eq(users.id, input.userId),
            eq(users.organizationId, scope.organizationId),
          ),
        )
        .limit(1);
      linkedUser = userRows[0];
      if (!linkedUser)
        throw new InvariantViolationError(
          "Select an authorized application user.",
        );
      const linked = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.userId, input.userId),
            exceptId ? sql`${employees.id} <> ${exceptId}::uuid` : sql`true`,
          ),
        )
        .limit(1);
      if (linked[0])
        throw new DuplicateResourceError(
          "That application user is already linked to another employee.",
        );
    }
    return { branch: branch[0], linkedUser };
  }
  async createEmployee(
    scope: TrustedEmployeeScope,
    input: EmployeeMutation,
    audit: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const { branch, linkedUser } = await this.assertParentAndUser(
        tx,
        scope,
        input,
      );
      const duplicate = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.organizationId, scope.organizationId),
            sql`lower(${employees.employeeNumber}) = lower(${input.employeeNumber})`,
          ),
        )
        .limit(1);
      if (duplicate[0])
        throw new DuplicateResourceError(
          "An employee with this number already exists in the organization.",
        );
      const rows = await tx
        .insert(employees)
        .values({
          organizationId: scope.organizationId,
          userId: input.userId ?? null,
          employeeNumber: input.employeeNumber,
          employmentStatus: input.employmentStatus,
          primaryBranchId: input.primaryBranchId,
          profile: {
            displayName: input.displayName,
            workPhone: input.workPhone,
          },
        })
        .returning({
          id: employees.id,
          employeeNumber: employees.employeeNumber,
          profile: employees.profile,
          employmentStatus: employees.employmentStatus,
          primaryBranchId: employees.primaryBranchId,
          updatedAt: employees.updatedAt,
        });
      const created = rows[0]!;
      const result: EmployeeSummary = {
        id: created.id,
        employeeNumber: created.employeeNumber,
        displayName: input.displayName,
        workPhone: input.workPhone,
        employmentStatus:
          created.employmentStatus === "inactive" ? "inactive" : "active",
        primaryBranchId: created.primaryBranchId,
        primaryBranchName: branch!.name,
        user: linkedUser
          ? {
              id: linkedUser.id,
              email: linkedUser.email,
              status: linkedUser.status === "inactive" ? "inactive" : "active",
            }
          : undefined,
        updatedAt: created.updatedAt.toISOString(),
      };
      await writeAudit(
        tx,
        audit,
        "employee.created",
        created.id,
        undefined,
        result,
      );
      return result;
    });
  }
  async updateEmployee(
    scope: TrustedEmployeeScope,
    id: string,
    input: EmployeeMutation,
    expected: string,
    audit: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const beforeRows = await tx
        .select(employeeProjection)
        .from(employees)
        .innerJoin(branches, eq(branches.id, employees.primaryBranchId))
        .leftJoin(users, eq(users.id, employees.userId))
        .where(and(scopeCondition(scope), eq(employees.id, id)))
        .limit(1);
      const before = beforeRows[0];
      if (!before) return null;
      if (before.updatedAt.toISOString() !== expected)
        throw new StaleUpdateError();
      const { branch, linkedUser } = await this.assertParentAndUser(
        tx,
        scope,
        input,
        id,
      );
      const duplicate = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.organizationId, scope.organizationId),
            sql`lower(${employees.employeeNumber}) = lower(${input.employeeNumber})`,
            sql`${employees.id} <> ${id}::uuid`,
          ),
        )
        .limit(1);
      if (duplicate[0])
        throw new DuplicateResourceError(
          "An employee with this number already exists in the organization.",
        );
      const rows = await tx
        .update(employees)
        .set({
          userId: input.userId ?? null,
          employeeNumber: input.employeeNumber,
          employmentStatus: input.employmentStatus,
          primaryBranchId: input.primaryBranchId,
          profile: {
            displayName: input.displayName,
            workPhone: input.workPhone,
          },
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(employees.id, id),
            eq(employees.organizationId, scope.organizationId),
            eq(employees.updatedAt, new Date(expected)),
          ),
        )
        .returning({
          id: employees.id,
          employeeNumber: employees.employeeNumber,
          employmentStatus: employees.employmentStatus,
          primaryBranchId: employees.primaryBranchId,
          updatedAt: employees.updatedAt,
        });
      if (!rows[0]) throw new StaleUpdateError();
      const updated = rows[0];
      const result: EmployeeSummary = {
        id: updated.id,
        employeeNumber: updated.employeeNumber,
        displayName: input.displayName,
        workPhone: input.workPhone,
        employmentStatus:
          updated.employmentStatus === "inactive" ? "inactive" : "active",
        primaryBranchId: updated.primaryBranchId,
        primaryBranchName: branch!.name,
        user: linkedUser
          ? {
              id: linkedUser.id,
              email: linkedUser.email,
              status: linkedUser.status === "inactive" ? "inactive" : "active",
            }
          : undefined,
        updatedAt: updated.updatedAt.toISOString(),
      };
      await writeAudit(tx, audit, "employee.updated", id, dto(before), result);
      return result;
    });
  }
}

export { EMPLOYEE_PAGE_SIZE };
