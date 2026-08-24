import "server-only";

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import {
  auditEvents,
  branches,
  clientContacts,
  clients,
  contracts,
  sites,
} from "@/server/db/schema";
import type { NexusDatabase } from "@/server/db/client";
import type { AuditContext } from "@/server/request/boundary";
import { matchesUpdatedAt } from "@/server/db/optimistic-concurrency";
import {
  DuplicateResourceError,
  InvariantViolationError,
  StaleUpdateError,
} from "@/server/request/errors";
import type {
  ClientSummary,
  ContactSummary,
  ContractSummary,
} from "./contracts";
import {
  RELATED_LIMIT,
  type ClientAdminRepository,
  type ClientMutation,
  type ContactMutation,
  type ContractMutation,
  type TrustedScope,
} from "./repository";

const clientProjection = {
  id: clients.id,
  branchId: clients.branchId,
  branchName: branches.name,
  name: clients.name,
  status: clients.status,
  updatedAt: clients.updatedAt,
};
const contactProjection = {
  id: clientContacts.id,
  clientId: clientContacts.clientId,
  name: clientContacts.name,
  email: clientContacts.email,
  phone: clientContacts.phone,
  status: clientContacts.status,
  updatedAt: clientContacts.updatedAt,
};
const contractProjection = {
  id: contracts.id,
  clientId: contracts.clientId,
  name: contracts.name,
  startsOn: contracts.startsOn,
  endsOn: contracts.endsOn,
  status: contracts.status,
  updatedAt: contracts.updatedAt,
};
function clientDto(row: {
  id: string;
  branchId: string | null;
  branchName: string;
  name: string;
  status: string;
  updatedAt: Date;
}): ClientSummary {
  return {
    id: row.id,
    branchId: row.branchId!,
    branchName: row.branchName,
    name: row.name,
    status: row.status === "inactive" ? "inactive" : "active",
    updatedAt: row.updatedAt.toISOString(),
  };
}
function contactDto(row: {
  id: string;
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  updatedAt: Date;
}): ContactSummary {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    status: row.status === "inactive" ? "inactive" : "active",
    updatedAt: row.updatedAt.toISOString(),
  };
}
function contractDto(row: {
  id: string;
  clientId: string;
  name: string;
  startsOn: string;
  endsOn: string | null;
  status: string;
  updatedAt: Date;
}): ContractSummary {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    startsOn: row.startsOn,
    endsOn: row.endsOn ?? undefined,
    status: row.status as ContractSummary["status"],
    updatedAt: row.updatedAt.toISOString(),
  };
}
function scopeCondition(scope: TrustedScope) {
  if (scope.organizationWide)
    return eq(clients.organizationId, scope.organizationId);
  const filters = [];
  if (scope.branchIds.length)
    filters.push(inArray(clients.branchId, [...scope.branchIds]));
  if (scope.clientIds.length)
    filters.push(inArray(clients.id, [...scope.clientIds]));
  return and(
    eq(clients.organizationId, scope.organizationId),
    filters.length ? or(...filters) : sql`false`,
  );
}
async function audit(
  transaction: Parameters<Parameters<NexusDatabase["transaction"]>[0]>[0],
  context: AuditContext,
  action: string,
  entityType: string,
  entityId: string,
  beforeState?: object,
  afterState?: object,
) {
  await transaction.insert(auditEvents).values({
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

export class PostgresClientAdminRepository implements ClientAdminRepository {
  constructor(private readonly database: NexusDatabase) {}
  async listBranches(scope: TrustedScope) {
    const predicate = scope.organizationWide
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
      .where(and(predicate, eq(branches.status, "active")))
      .orderBy(asc(branches.name), asc(branches.id))
      .limit(101);
  }
  async listClients(scope: TrustedScope, limit: number) {
    const rows = await this.database
      .select(clientProjection)
      .from(clients)
      .innerJoin(branches, eq(clients.branchId, branches.id))
      .where(scopeCondition(scope))
      .orderBy(asc(clients.name), asc(clients.id))
      .limit(limit + 1);
    return {
      items: rows.slice(0, limit).map(clientDto),
      hasMore: rows.length > limit,
    };
  }
  async getClient(scope: TrustedScope, clientId: string) {
    const rows = await this.database
      .select(clientProjection)
      .from(clients)
      .innerJoin(branches, eq(clients.branchId, branches.id))
      .where(and(scopeCondition(scope), eq(clients.id, clientId)))
      .limit(1);
    return rows[0] ? clientDto(rows[0]) : null;
  }
  async getClientDetail(scope: TrustedScope, clientId: string) {
    const client = await this.getClient(scope, clientId);
    if (!client) return null;
    const [contactRows, contractRows] = await Promise.all([
      this.database
        .select(contactProjection)
        .from(clientContacts)
        .where(eq(clientContacts.clientId, clientId))
        .orderBy(asc(clientContacts.name), asc(clientContacts.id))
        .limit(RELATED_LIMIT),
      this.database
        .select(contractProjection)
        .from(contracts)
        .where(eq(contracts.clientId, clientId))
        .orderBy(asc(contracts.startsOn), asc(contracts.id))
        .limit(RELATED_LIMIT),
    ]);
    return {
      client,
      contacts: contactRows.map(contactDto),
      contracts: contractRows.map(contractDto),
    };
  }
  async createClient(
    scope: TrustedScope,
    input: ClientMutation,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const parent = await tx
        .select({ id: branches.id })
        .from(branches)
        .where(
          and(
            eq(branches.id, input.branchId),
            eq(branches.organizationId, scope.organizationId),
            eq(branches.status, "active"),
          ),
        )
        .limit(1);
      if (!parent[0])
        throw new InvariantViolationError(
          "Select an active authorized branch.",
        );
      const duplicate = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.organizationId, scope.organizationId),
            eq(clients.branchId, input.branchId),
            sql`lower(${clients.name}) = lower(${input.name})`,
            eq(clients.status, "active"),
          ),
        )
        .limit(1);
      if (input.status === "active" && duplicate[0])
        throw new DuplicateResourceError(
          "An active client with this name already exists in the branch.",
        );
      const rows = await tx
        .insert(clients)
        .values({ organizationId: scope.organizationId, ...input })
        .returning({
          id: clients.id,
          branchId: clients.branchId,
          name: clients.name,
          status: clients.status,
          updatedAt: clients.updatedAt,
        });
      const created = rows[0]!;
      const result: ClientSummary = {
        ...created,
        branchId: created.branchId!,
        branchName: "",
        status: created.status as ClientSummary["status"],
        updatedAt: created.updatedAt.toISOString(),
      };
      await audit(
        tx,
        context,
        "client.created",
        "Client",
        created.id,
        undefined,
        result,
      );
      return result;
    });
  }
  async updateClient(
    scope: TrustedScope,
    clientId: string,
    input: ClientMutation,
    expected: string,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const beforeRows = await tx
        .select(clientProjection)
        .from(clients)
        .innerJoin(branches, eq(clients.branchId, branches.id))
        .where(and(scopeCondition(scope), eq(clients.id, clientId)))
        .limit(1);
      const before = beforeRows[0];
      if (!before) return null;
      if (before.updatedAt.toISOString() !== expected)
        throw new StaleUpdateError();
      const parent = await tx
        .select({ id: branches.id })
        .from(branches)
        .where(
          and(
            eq(branches.id, input.branchId),
            eq(branches.organizationId, scope.organizationId),
            eq(branches.status, "active"),
          ),
        )
        .limit(1);
      if (!parent[0])
        throw new InvariantViolationError(
          "Select an active authorized branch.",
        );
      const guard = await tx.execute(
        sql`select exists(select 1 from ${clients} where ${clients.organizationId}=${scope.organizationId} and ${clients.branchId}=${input.branchId} and ${clients.id}<>${clientId} and lower(${clients.name})=lower(${input.name}) and ${clients.status}='active') duplicate, exists(select 1 from ${sites} where ${sites.clientId}=${clientId} and ${sites.active}=true union all select 1 from ${contracts} where ${contracts.clientId}=${clientId} and ${contracts.status}='active') active_dependencies`,
      );
      if (input.status === "active" && Boolean(guard.rows[0]?.duplicate))
        throw new DuplicateResourceError(
          "An active client with this name already exists in the branch.",
        );
      if (
        input.status === "inactive" &&
        Boolean(guard.rows[0]?.active_dependencies)
      )
        throw new InvariantViolationError(
          "Deactivate active sites and contracts before deactivating this client.",
        );
      const rows = await tx
        .update(clients)
        .set({ ...input, updatedAt: new Date() })
        .where(
          and(
            eq(clients.id, clientId),
            eq(clients.organizationId, scope.organizationId),
            matchesUpdatedAt(clients.updatedAt, expected),
          ),
        )
        .returning({
          id: clients.id,
          branchId: clients.branchId,
          name: clients.name,
          status: clients.status,
          updatedAt: clients.updatedAt,
        });
      if (!rows[0]) throw new StaleUpdateError();
      const result: ClientSummary = {
        ...rows[0],
        branchId: rows[0].branchId!,
        branchName: before.branchName,
        status: rows[0].status as ClientSummary["status"],
        updatedAt: rows[0].updatedAt.toISOString(),
      };
      await audit(
        tx,
        context,
        "client.updated",
        "Client",
        clientId,
        clientDto(before),
        result,
      );
      return result;
    });
  }
  async createContact(
    scope: TrustedScope,
    input: ContactMutation,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const parent = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(scopeCondition(scope), eq(clients.id, input.clientId)))
        .limit(1);
      if (!parent[0])
        throw new InvariantViolationError("Select an authorized client.");
      const rows = await tx
        .insert(clientContacts)
        .values(input)
        .returning(contactProjection);
      const result = contactDto(rows[0]!);
      await audit(
        tx,
        context,
        "client_contact.created",
        "ClientContact",
        result.id,
        undefined,
        result,
      );
      return result;
    });
  }
  async updateContact(
    scope: TrustedScope,
    contactId: string,
    input: ContactMutation,
    expected: string,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const rows = await tx
        .select(contactProjection)
        .from(clientContacts)
        .innerJoin(clients, eq(clientContacts.clientId, clients.id))
        .where(
          and(
            scopeCondition(scope),
            eq(clientContacts.id, contactId),
            eq(clientContacts.clientId, input.clientId),
          ),
        )
        .limit(1);
      const before = rows[0];
      if (!before) return null;
      if (before.updatedAt.toISOString() !== expected)
        throw new StaleUpdateError();
      const updated = await tx
        .update(clientContacts)
        .set({
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          status: input.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clientContacts.id, contactId),
            eq(clientContacts.clientId, input.clientId),
            matchesUpdatedAt(clientContacts.updatedAt, expected),
          ),
        )
        .returning(contactProjection);
      if (!updated[0]) throw new StaleUpdateError();
      const result = contactDto(updated[0]);
      await audit(
        tx,
        context,
        "client_contact.updated",
        "ClientContact",
        contactId,
        contactDto(before),
        result,
      );
      return result;
    });
  }
  private async assertNoOverlap(
    tx: Parameters<Parameters<NexusDatabase["transaction"]>[0]>[0],
    input: ContractMutation,
    exceptId?: string,
  ) {
    if (input.status !== "active") return;
    const conditions = [
      eq(contracts.clientId, input.clientId),
      eq(contracts.status, "active"),
      sql`${contracts.startsOn} <= coalesce(${input.endsOn ?? null}::date, 'infinity'::date)`,
      sql`coalesce(${contracts.endsOn}, 'infinity'::date) >= ${input.startsOn}::date`,
    ];
    if (exceptId) conditions.push(sql`${contracts.id} <> ${exceptId}::uuid`);
    const rows = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(...conditions))
      .limit(1);
    if (rows[0])
      throw new InvariantViolationError(
        "An active contract already covers part of this date range.",
      );
  }
  async createContract(
    scope: TrustedScope,
    input: ContractMutation,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const parent = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(scopeCondition(scope), eq(clients.id, input.clientId)))
        .limit(1);
      if (!parent[0])
        throw new InvariantViolationError("Select an authorized client.");
      await this.assertNoOverlap(tx, input);
      const rows = await tx
        .insert(contracts)
        .values({ ...input, endsOn: input.endsOn ?? null })
        .returning(contractProjection);
      const result = contractDto(rows[0]!);
      await audit(
        tx,
        context,
        "contract.created",
        "Contract",
        result.id,
        undefined,
        result,
      );
      return result;
    });
  }
  async updateContract(
    scope: TrustedScope,
    contractId: string,
    input: ContractMutation,
    expected: string,
    context: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      const rows = await tx
        .select(contractProjection)
        .from(contracts)
        .innerJoin(clients, eq(contracts.clientId, clients.id))
        .where(
          and(
            scopeCondition(scope),
            eq(contracts.id, contractId),
            eq(contracts.clientId, input.clientId),
          ),
        )
        .limit(1);
      const before = rows[0];
      if (!before) return null;
      if (before.updatedAt.toISOString() !== expected)
        throw new StaleUpdateError();
      await this.assertNoOverlap(tx, input, contractId);
      const updated = await tx
        .update(contracts)
        .set({
          name: input.name,
          startsOn: input.startsOn,
          endsOn: input.endsOn ?? null,
          status: input.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(contracts.id, contractId),
            eq(contracts.clientId, input.clientId),
            matchesUpdatedAt(contracts.updatedAt, expected),
          ),
        )
        .returning(contractProjection);
      if (!updated[0]) throw new StaleUpdateError();
      const result = contractDto(updated[0]);
      await audit(
        tx,
        context,
        "contract.updated",
        "Contract",
        contractId,
        contractDto(before),
        result,
      );
      return result;
    });
  }
}
