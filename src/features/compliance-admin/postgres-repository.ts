import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  auditEvents,
  branches,
  certifications,
  credentials,
  employees,
} from "@/server/db/schema";
import type { NexusDatabase } from "@/server/db/client";
import type { AuditContext } from "@/server/request/boundary";
import {
  ResourceNotFoundError,
  StaleUpdateError,
} from "@/server/request/errors";
import type {
  ComplianceDetail,
  ComplianceKind,
  ComplianceSummary,
  EmployeeComplianceOption,
} from "./contracts";
import {
  COMPLIANCE_HISTORY_LIMIT,
  EMPLOYEE_OPTION_LIMIT,
  type ComplianceAdminRepository,
  type ComplianceMutation,
  type TrustedComplianceScope,
} from "./repository";

type Row = {
  id: string;
  employeeId: string;
  type: string;
  identifier?: string | null;
  issuingAuthority: string;
  issuedOn: string;
  expiresOn: string | null;
  status: string;
  documentReference: string | null;
  predecessorId: string | null;
  verifiedAt: Date | null;
  updatedAt: Date;
};
function status(value: string): ComplianceSummary["status"] {
  return value as ComplianceSummary["status"];
}
function credentialDto(row: Row): ComplianceSummary {
  return {
    id: row.id,
    employeeId: row.employeeId,
    kind: "credential",
    type: row.type,
    identifier: row.identifier ?? undefined,
    issuingAuthority: row.issuingAuthority,
    issuedOn: row.issuedOn,
    expiresOn: row.expiresOn ?? undefined,
    status: status(row.status),
    documentReference: row.documentReference ?? undefined,
    predecessorId: row.predecessorId ?? undefined,
    verifiedAt: row.verifiedAt?.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function certificationDto(row: Row): ComplianceSummary {
  return {
    ...credentialDto(row),
    kind: "certification",
    identifier: undefined,
  };
}
function scopeCondition(scope: TrustedComplianceScope) {
  return scope.organizationWide
    ? eq(employees.organizationId, scope.organizationId)
    : and(
        eq(employees.organizationId, scope.organizationId),
        scope.branchIds.length
          ? inArray(employees.primaryBranchId, [...scope.branchIds])
          : sql`false`,
      );
}
function employeeOption(row: {
  id: string;
  employeeNumber: string;
  profile: unknown;
  primaryBranchId: string;
  branchName: string;
  employmentStatus: string;
}): EmployeeComplianceOption {
  const profile =
    typeof row.profile === "object" && row.profile
      ? (row.profile as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    displayName:
      typeof profile.displayName === "string"
        ? profile.displayName
        : row.employeeNumber,
    branchId: row.primaryBranchId,
    branchName: row.branchName,
    employmentStatus:
      row.employmentStatus === "inactive" ? "inactive" : "active",
  };
}
async function audit(
  tx: Parameters<Parameters<NexusDatabase["transaction"]>[0]>[0],
  context: AuditContext,
  action: string,
  kind: ComplianceKind,
  id: string,
  beforeState?: object,
  afterState?: object,
) {
  await tx.insert(auditEvents).values({
    organizationId: context.organizationId,
    actorUserId: context.actorUserId,
    action,
    entityType: kind === "credential" ? "Credential" : "Certification",
    entityId: id,
    requestId: context.requestId,
    sessionId: context.sessionId,
    beforeState,
    afterState,
  });
}
export class PostgresComplianceAdminRepository implements ComplianceAdminRepository {
  constructor(private readonly database: NexusDatabase) {}
  async listEmployees(scope: TrustedComplianceScope) {
    const rows = await this.database
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        profile: employees.profile,
        primaryBranchId: employees.primaryBranchId,
        branchName: branches.name,
        employmentStatus: employees.employmentStatus,
      })
      .from(employees)
      .innerJoin(branches, eq(branches.id, employees.primaryBranchId))
      .where(scopeCondition(scope))
      .orderBy(asc(employees.employeeNumber), asc(employees.id))
      .limit(EMPLOYEE_OPTION_LIMIT);
    return rows.map(employeeOption);
  }
  async getEmployeeDetail(
    scope: TrustedComplianceScope,
    employeeId: string,
  ): Promise<ComplianceDetail | null> {
    const employeeRows = await this.database
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        profile: employees.profile,
        primaryBranchId: employees.primaryBranchId,
        branchName: branches.name,
        employmentStatus: employees.employmentStatus,
      })
      .from(employees)
      .innerJoin(branches, eq(branches.id, employees.primaryBranchId))
      .where(and(scopeCondition(scope), eq(employees.id, employeeId)))
      .limit(1);
    const employee = employeeRows[0];
    if (!employee) return null;
    const [credentialRows, certificationRows] = await Promise.all([
      this.database
        .select({
          id: credentials.id,
          employeeId: credentials.employeeId,
          type: credentials.type,
          identifier: credentials.identifier,
          issuingAuthority: credentials.issuingAuthority,
          issuedOn: credentials.issuedOn,
          expiresOn: credentials.expiresOn,
          status: credentials.status,
          documentReference: credentials.documentReference,
          predecessorId: credentials.predecessorId,
          verifiedAt: credentials.verifiedAt,
          updatedAt: credentials.updatedAt,
        })
        .from(credentials)
        .where(eq(credentials.employeeId, employeeId))
        .orderBy(asc(credentials.issuedOn), asc(credentials.id))
        .limit(COMPLIANCE_HISTORY_LIMIT),
      this.database
        .select({
          id: certifications.id,
          employeeId: certifications.employeeId,
          type: certifications.type,
          issuingAuthority: certifications.issuingAuthority,
          issuedOn: certifications.issuedOn,
          expiresOn: certifications.expiresOn,
          status: certifications.status,
          documentReference: certifications.documentReference,
          predecessorId: certifications.predecessorId,
          verifiedAt: certifications.verifiedAt,
          updatedAt: certifications.updatedAt,
        })
        .from(certifications)
        .where(eq(certifications.employeeId, employeeId))
        .orderBy(asc(certifications.issuedOn), asc(certifications.id))
        .limit(COMPLIANCE_HISTORY_LIMIT),
    ]);
    return {
      employee: employeeOption(employee),
      credentials: credentialRows.map(credentialDto),
      certifications: certificationRows.map((row) => certificationDto(row)),
    };
  }
  async getRecord(
    scope: TrustedComplianceScope,
    kind: ComplianceKind,
    recordId: string,
  ) {
    const table = kind === "credential" ? credentials : certifications;
    const rows = await this.database
      .select({
        id: table.id,
        employeeId: table.employeeId,
        type: table.type,
        identifier:
          kind === "credential"
            ? credentials.identifier
            : sql<string | null>`null`,
        issuingAuthority: table.issuingAuthority,
        issuedOn: table.issuedOn,
        expiresOn: table.expiresOn,
        status: table.status,
        documentReference: table.documentReference,
        predecessorId: table.predecessorId,
        verifiedAt: table.verifiedAt,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .innerJoin(employees, eq(employees.id, table.employeeId))
      .where(and(scopeCondition(scope), eq(table.id, recordId)))
      .limit(1);
    return rows[0]
      ? kind === "credential"
        ? credentialDto(rows[0])
        : certificationDto(rows[0])
      : null;
  }
  async create(
    scope: TrustedComplianceScope,
    kind: ComplianceKind,
    input: ComplianceMutation,
    context: AuditContext,
    predecessorId?: string,
  ) {
    return this.database.transaction(async (tx) => {
      const employeeRows = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(and(scopeCondition(scope), eq(employees.id, input.employeeId)))
        .limit(1);
      if (!employeeRows[0]) throw new ResourceNotFoundError("Employee");
      const common = {
        employeeId: input.employeeId,
        type: input.type,
        issuingAuthority: input.issuingAuthority,
        issuedOn: input.issuedOn,
        expiresOn: input.expiresOn ?? null,
        status: input.status,
        documentReference: input.documentReference ?? null,
        predecessorId: predecessorId ?? null,
      };
      if (kind === "credential") {
        const rows = await tx
          .insert(credentials)
          .values({ ...common, identifier: input.identifier ?? null })
          .returning({
            id: credentials.id,
            employeeId: credentials.employeeId,
            type: credentials.type,
            identifier: credentials.identifier,
            issuingAuthority: credentials.issuingAuthority,
            issuedOn: credentials.issuedOn,
            expiresOn: credentials.expiresOn,
            status: credentials.status,
            documentReference: credentials.documentReference,
            predecessorId: credentials.predecessorId,
            verifiedAt: credentials.verifiedAt,
            updatedAt: credentials.updatedAt,
          });
        const result = credentialDto(rows[0]!);
        await audit(
          tx,
          context,
          predecessorId ? "credential.renewed" : "credential.created",
          kind,
          result.id,
          undefined,
          result,
        );
        return result;
      }
      const rows = await tx.insert(certifications).values(common).returning({
        id: certifications.id,
        employeeId: certifications.employeeId,
        type: certifications.type,
        issuingAuthority: certifications.issuingAuthority,
        issuedOn: certifications.issuedOn,
        expiresOn: certifications.expiresOn,
        status: certifications.status,
        documentReference: certifications.documentReference,
        predecessorId: certifications.predecessorId,
        verifiedAt: certifications.verifiedAt,
        updatedAt: certifications.updatedAt,
      });
      const result = certificationDto(rows[0]!);
      await audit(
        tx,
        context,
        predecessorId ? "certification.renewed" : "certification.created",
        kind,
        result.id,
        undefined,
        result,
      );
      return result;
    });
  }
  async update(
    scope: TrustedComplianceScope,
    kind: ComplianceKind,
    recordId: string,
    input: ComplianceMutation,
    expected: string,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const before = await this.getRecord(scope, kind, recordId);
      if (!before) return null;
      if (before.updatedAt !== expected) throw new StaleUpdateError();
      if (kind === "credential") {
        const rows = await tx
          .update(credentials)
          .set({
            type: input.type,
            identifier: input.identifier ?? null,
            issuingAuthority: input.issuingAuthority,
            issuedOn: input.issuedOn,
            expiresOn: input.expiresOn ?? null,
            status: input.status,
            documentReference: input.documentReference ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(credentials.id, recordId),
              eq(credentials.updatedAt, new Date(expected)),
            ),
          )
          .returning({
            id: credentials.id,
            employeeId: credentials.employeeId,
            type: credentials.type,
            identifier: credentials.identifier,
            issuingAuthority: credentials.issuingAuthority,
            issuedOn: credentials.issuedOn,
            expiresOn: credentials.expiresOn,
            status: credentials.status,
            documentReference: credentials.documentReference,
            predecessorId: credentials.predecessorId,
            verifiedAt: credentials.verifiedAt,
            updatedAt: credentials.updatedAt,
          });
        if (!rows[0]) throw new StaleUpdateError();
        const result = credentialDto(rows[0]);
        await audit(
          tx,
          context,
          "credential.updated",
          kind,
          recordId,
          before,
          result,
        );
        return result;
      }
      const rows = await tx
        .update(certifications)
        .set({
          type: input.type,
          issuingAuthority: input.issuingAuthority,
          issuedOn: input.issuedOn,
          expiresOn: input.expiresOn ?? null,
          status: input.status,
          documentReference: input.documentReference ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(certifications.id, recordId),
            eq(certifications.updatedAt, new Date(expected)),
          ),
        )
        .returning({
          id: certifications.id,
          employeeId: certifications.employeeId,
          type: certifications.type,
          issuingAuthority: certifications.issuingAuthority,
          issuedOn: certifications.issuedOn,
          expiresOn: certifications.expiresOn,
          status: certifications.status,
          documentReference: certifications.documentReference,
          predecessorId: certifications.predecessorId,
          verifiedAt: certifications.verifiedAt,
          updatedAt: certifications.updatedAt,
        });
      if (!rows[0]) throw new StaleUpdateError();
      const result = certificationDto(rows[0]);
      await audit(
        tx,
        context,
        "certification.updated",
        kind,
        recordId,
        before,
        result,
      );
      return result;
    });
  }
  async verify(
    scope: TrustedComplianceScope,
    kind: ComplianceKind,
    recordId: string,
    expected: string,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const before = await this.getRecord(scope, kind, recordId);
      if (!before) return null;
      if (before.updatedAt !== expected) throw new StaleUpdateError();
      if (kind === "credential") {
        const rows = await tx
          .update(credentials)
          .set({
            status: "active",
            verifiedByUserId: context.actorUserId,
            verifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(credentials.id, recordId),
              eq(credentials.updatedAt, new Date(expected)),
            ),
          )
          .returning({
            id: credentials.id,
            employeeId: credentials.employeeId,
            type: credentials.type,
            identifier: credentials.identifier,
            issuingAuthority: credentials.issuingAuthority,
            issuedOn: credentials.issuedOn,
            expiresOn: credentials.expiresOn,
            status: credentials.status,
            documentReference: credentials.documentReference,
            predecessorId: credentials.predecessorId,
            verifiedAt: credentials.verifiedAt,
            updatedAt: credentials.updatedAt,
          });
        if (!rows[0]) throw new StaleUpdateError();
        const result = credentialDto(rows[0]);
        await audit(
          tx,
          context,
          "credential.verified",
          kind,
          recordId,
          before,
          result,
        );
        return result;
      }
      const rows = await tx
        .update(certifications)
        .set({
          status: "active",
          verifiedByUserId: context.actorUserId,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(certifications.id, recordId),
            eq(certifications.updatedAt, new Date(expected)),
          ),
        )
        .returning({
          id: certifications.id,
          employeeId: certifications.employeeId,
          type: certifications.type,
          issuingAuthority: certifications.issuingAuthority,
          issuedOn: certifications.issuedOn,
          expiresOn: certifications.expiresOn,
          status: certifications.status,
          documentReference: certifications.documentReference,
          predecessorId: certifications.predecessorId,
          verifiedAt: certifications.verifiedAt,
          updatedAt: certifications.updatedAt,
        });
      if (!rows[0]) throw new StaleUpdateError();
      const result = certificationDto(rows[0]);
      await audit(
        tx,
        context,
        "certification.verified",
        kind,
        recordId,
        before,
        result,
      );
      return result;
    });
  }
}
