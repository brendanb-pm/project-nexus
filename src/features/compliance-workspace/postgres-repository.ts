import "server-only";
import { and, asc, eq, gte, inArray, or, sql } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import {
  branches,
  clients,
  credentialDefinitions,
  employeeCredentials,
  employees,
  postCredentialRequirements,
  posts,
  shiftAssignments,
  shifts,
  sites,
} from "@/server/db/schema";
import type { CredentialJurisdiction } from "@/features/compliance-admin/canonical";
import type {
  ComplianceWorkspaceRepository,
  ComplianceWorkspaceScope,
} from "./repository";

function scopePredicate(scope: ComplianceWorkspaceScope) {
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

function employeeScopePredicate(scope: ComplianceWorkspaceScope) {
  if (scope.organizationWide)
    return eq(employees.organizationId, scope.organizationId);
  return and(
    eq(employees.organizationId, scope.organizationId),
    scope.branchIds.length
      ? inArray(employees.primaryBranchId, [...scope.branchIds])
      : sql`false`,
  );
}

function profileName(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const profile = value as Record<string, unknown>;
  return typeof profile.name === "string"
    ? profile.name
    : typeof profile.displayName === "string"
      ? profile.displayName
      : fallback;
}

function jurisdiction(row: {
  jurisdictionKind: string;
  jurisdictionCode: string | null;
  jurisdictionTimezone: string | null;
}): CredentialJurisdiction {
  return {
    kind: row.jurisdictionKind as CredentialJurisdiction["kind"],
    ...(row.jurisdictionCode ? { code: row.jurisdictionCode } : {}),
    ...(row.jurisdictionTimezone ? { timezone: row.jurisdictionTimezone } : {}),
  };
}

export class PostgresComplianceWorkspaceRepository implements ComplianceWorkspaceRepository {
  constructor(private readonly database: NexusDatabase) {}

  async load(scope: ComplianceWorkspaceScope, now: string) {
    const [credentialRows, requirementRows, assignmentRows] = await Promise.all(
      [
        this.database
          .select({
            id: employeeCredentials.id,
            employeeId: employees.id,
            employeeNumber: employees.employeeNumber,
            profile: employees.profile,
            branchId: branches.id,
            branchName: branches.name,
            definitionId: credentialDefinitions.id,
            key: credentialDefinitions.key,
            displayName: credentialDefinitions.displayName,
            jurisdictionKind: credentialDefinitions.jurisdictionKind,
            jurisdictionCode: credentialDefinitions.jurisdictionCode,
            jurisdictionTimezone: credentialDefinitions.jurisdictionTimezone,
            warningDays: credentialDefinitions.warningDays,
            state: employeeCredentials.state,
            expiresOn: employeeCredentials.expiresOn,
          })
          .from(employeeCredentials)
          .innerJoin(
            employees,
            eq(employeeCredentials.employeeId, employees.id),
          )
          .innerJoin(branches, eq(employees.primaryBranchId, branches.id))
          .innerJoin(
            credentialDefinitions,
            eq(
              employeeCredentials.credentialDefinitionId,
              credentialDefinitions.id,
            ),
          )
          .where(employeeScopePredicate(scope))
          .orderBy(
            asc(employees.employeeNumber),
            asc(credentialDefinitions.displayName),
            asc(employeeCredentials.id),
          )
          .limit(1000),
        this.database
          .select({
            id: postCredentialRequirements.id,
            postId: posts.id,
            definitionId: credentialDefinitions.id,
            key: credentialDefinitions.key,
            displayName: credentialDefinitions.displayName,
            severity: postCredentialRequirements.severity,
            effectiveStart: postCredentialRequirements.effectiveStart,
            effectiveEnd: postCredentialRequirements.effectiveEnd,
            jurisdictionKind: credentialDefinitions.jurisdictionKind,
            jurisdictionCode: credentialDefinitions.jurisdictionCode,
            jurisdictionTimezone: credentialDefinitions.jurisdictionTimezone,
          })
          .from(postCredentialRequirements)
          .innerJoin(posts, eq(postCredentialRequirements.postId, posts.id))
          .innerJoin(sites, eq(posts.siteId, sites.id))
          .innerJoin(clients, eq(sites.clientId, clients.id))
          .innerJoin(
            credentialDefinitions,
            eq(
              postCredentialRequirements.credentialDefinitionId,
              credentialDefinitions.id,
            ),
          )
          .where(
            and(scopePredicate(scope), eq(credentialDefinitions.active, true)),
          )
          .orderBy(
            asc(posts.id),
            asc(postCredentialRequirements.effectiveStart),
            asc(postCredentialRequirements.id),
          )
          .limit(1000),
        this.database
          .select({
            id: shiftAssignments.id,
            employeeId: employees.id,
            employeeNumber: employees.employeeNumber,
            profile: employees.profile,
            branchId: branches.id,
            branchName: branches.name,
            postId: posts.id,
            siteId: sites.id,
            siteName: sites.name,
            postName: posts.name,
            startsAt: shifts.scheduledStart,
            endsAt: shifts.scheduledEnd,
            timezone: shifts.timezone,
          })
          .from(shiftAssignments)
          .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
          .innerJoin(posts, eq(shifts.postId, posts.id))
          .innerJoin(sites, eq(posts.siteId, sites.id))
          .innerJoin(clients, eq(sites.clientId, clients.id))
          .innerJoin(employees, eq(shiftAssignments.employeeId, employees.id))
          .innerJoin(branches, eq(employees.primaryBranchId, branches.id))
          .where(
            and(
              scopePredicate(scope),
              gte(shifts.scheduledEnd, new Date(now)),
              sql`${shifts.status} in ('PUBLISHED', 'COMPLETED')`,
              sql`${shiftAssignments.status} in ('assigned', 'confirmed')`,
            ),
          )
          .orderBy(asc(shifts.scheduledStart), asc(shiftAssignments.id))
          .limit(500),
      ],
    );
    return {
      credentials: credentialRows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: profileName(row.profile, row.employeeNumber),
        employeeNumber: row.employeeNumber,
        branchId: row.branchId,
        branchName: row.branchName,
        definitionId: row.definitionId,
        key: row.key,
        displayName: row.displayName,
        state: row.state as
          | "pending_verification"
          | "verified"
          | "expired"
          | "suspended"
          | "revoked"
          | "superseded",
        ...(row.expiresOn ? { expiresOn: row.expiresOn } : {}),
        jurisdiction: jurisdiction(row),
        warningDays: Array.isArray(row.warningDays)
          ? row.warningDays.filter(
              (value): value is number => typeof value === "number",
            )
          : [60, 30, 14, 7],
      })),
      requirements: requirementRows.map((row) => ({
        id: row.id,
        postId: row.postId,
        definitionId: row.definitionId,
        key: row.key,
        displayName: row.displayName,
        severity: row.severity as "required" | "informational",
        jurisdiction: jurisdiction(row),
        effectiveStart: row.effectiveStart,
        ...(row.effectiveEnd ? { effectiveEnd: row.effectiveEnd } : {}),
      })),
      assignments: assignmentRows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: profileName(row.profile, row.employeeNumber),
        employeeNumber: row.employeeNumber,
        branchId: row.branchId,
        branchName: row.branchName,
        postId: row.postId,
        siteId: row.siteId,
        siteName: row.siteName,
        postName: row.postName,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        timezone: row.timezone,
      })),
    };
  }
}
