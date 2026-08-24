import "server-only";

import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { roles, type Role } from "@/domain/model";
import { getDatabase, type NexusDatabase } from "@/server/db/client";
import {
  authAccounts,
  branches,
  clients,
  employeeRoles,
  employees,
  externalIdentities,
  organizations,
  sites,
  userMemberships,
  users,
} from "@/server/db/schema";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";

export type VerifiedExternalSession = {
  authUserId: string;
  sessionId: string;
  authenticatedAt: string;
  provider: string;
};

export interface ExternalSessionVerifier {
  verify(): Promise<VerifiedExternalSession | null>;
}

export interface MembershipResolver {
  resolve(authUserId: string): Promise<AuthenticatedPrincipal | null>;
}

const MAX_ROLE_ASSIGNMENTS = 100;

export class PostgresMembershipResolver implements MembershipResolver {
  constructor(private readonly database: NexusDatabase = getDatabase()) {}

  async resolve(authUserId: string): Promise<AuthenticatedPrincipal | null> {
    const identityRows = await this.database
      .selectDistinct({
        userId: users.id,
        userStatus: users.status,
        organizationId: users.organizationId,
        organizationStatus: organizations.status,
        membershipStatus: userMemberships.status,
        employeeId: employees.id,
        employmentStatus: employees.employmentStatus,
      })
      .from(authAccounts)
      .innerJoin(
        externalIdentities,
        and(
          eq(externalIdentities.issuer, authAccounts.issuer),
          eq(externalIdentities.subject, authAccounts.accountId),
        ),
      )
      .innerJoin(users, eq(users.id, externalIdentities.userId))
      .innerJoin(
        userMemberships,
        and(
          eq(userMemberships.userId, users.id),
          eq(userMemberships.organizationId, users.organizationId),
        ),
      )
      .innerJoin(organizations, eq(organizations.id, users.organizationId))
      .leftJoin(
        employees,
        and(
          eq(employees.userId, users.id),
          eq(employees.organizationId, users.organizationId),
        ),
      )
      .where(eq(authAccounts.userId, authUserId))
      .limit(2);

    if (identityRows.length !== 1) return null;
    const identity = identityRows[0];
    if (
      identity.userStatus !== "active" ||
      identity.organizationStatus !== "active" ||
      identity.membershipStatus !== "active" ||
      (identity.employeeId && identity.employmentStatus !== "active")
    ) {
      return null;
    }

    const scopedClients = alias(clients, "membership_scoped_clients");
    const siteClients = alias(clients, "membership_site_clients");
    const roleRows = identity.employeeId
      ? await this.database
          .select({
            role: employeeRoles.role,
            branchId: employeeRoles.branchId,
            branchOrganizationId: branches.organizationId,
            clientId: employeeRoles.clientId,
            clientOrganizationId: scopedClients.organizationId,
            clientBranchId: scopedClients.branchId,
            siteId: employeeRoles.siteId,
            siteClientId: sites.clientId,
            siteOrganizationId: siteClients.organizationId,
          })
          .from(employeeRoles)
          .leftJoin(branches, eq(branches.id, employeeRoles.branchId))
          .leftJoin(scopedClients, eq(scopedClients.id, employeeRoles.clientId))
          .leftJoin(sites, eq(sites.id, employeeRoles.siteId))
          .leftJoin(siteClients, eq(siteClients.id, sites.clientId))
          .where(eq(employeeRoles.employeeId, identity.employeeId))
          .limit(MAX_ROLE_ASSIGNMENTS + 1)
      : [];

    if (roleRows.length > MAX_ROLE_ASSIGNMENTS) return null;
    for (const row of roleRows) {
      if (!roles.includes(row.role)) return null;
      if (
        (row.branchId &&
          row.branchOrganizationId !== identity.organizationId) ||
        (row.clientId &&
          (row.clientOrganizationId !== identity.organizationId ||
            (row.branchId && row.clientBranchId !== row.branchId))) ||
        (row.siteId &&
          (row.siteOrganizationId !== identity.organizationId ||
            (row.clientId && row.siteClientId !== row.clientId)))
      ) {
        return null;
      }
    }

    const assignedRoles = new Set<Role>();
    const branchIds = new Set<string>();
    const clientIds = new Set<string>();
    const siteIds = new Set<string>();
    let organizationWide = false;
    for (const row of roleRows) {
      assignedRoles.add(row.role);
      if (row.branchId) branchIds.add(row.branchId);
      if (row.clientId) clientIds.add(row.clientId);
      if (row.siteId) siteIds.add(row.siteId);
      if (!row.branchId && !row.clientId && !row.siteId)
        organizationWide = true;
    }

    return {
      userId: identity.userId,
      employeeId: identity.employeeId ?? undefined,
      organizationId: identity.organizationId,
      organizationWide,
      roles: [...assignedRoles],
      branchIds: [...branchIds],
      clientIds: [...clientIds],
      siteIds: [...siteIds],
    };
  }
}
