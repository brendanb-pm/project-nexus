import { and, eq, lt, ne, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import type { NexusDatabase } from "@/server/db/client";
import {
  auditEvents,
  clients,
  employees,
  posts,
  reportingDrafts,
  shiftAssignments,
  shifts,
  sites,
} from "@/server/db/schema";
import type { AuditContext } from "@/server/request/boundary";
import {
  ResourceNotFoundError,
  StaleUpdateError,
} from "@/server/request/errors";
import type {
  DraftFamily,
  DraftFinalization,
  ReportingDraft,
} from "./contracts";

type DraftRow = typeof reportingDrafts.$inferSelect;
type DraftTx = Parameters<Parameters<NexusDatabase["transaction"]>[0]>[0];

const dto = (row: DraftRow): ReportingDraft => ({
  id: row.id,
  shiftAssignmentId: row.shiftAssignmentId,
  family: row.family as DraftFamily,
  clientDraftKey: row.clientDraftKey,
  submissionKey: row.submissionKey,
  payload: row.payload as Record<string, unknown>,
  revision: row.revision,
  disposition: row.disposition as ReportingDraft["disposition"],
  updatedAt: row.updatedAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
  ...(row.canonicalRecordId
    ? { canonicalRecordId: row.canonicalRecordId }
    : {}),
});

/** This predicate independently rechecks the trusted actor/tenant/assignment
 * relationship at the persistence boundary. */
function ownerPredicate(
  organizationId: string,
  ownerUserId: string,
  ownerEmployeeId: string,
  assignmentId: string,
) {
  return and(
    eq(clients.organizationId, organizationId),
    eq(employees.userId, ownerUserId),
    eq(employees.id, ownerEmployeeId),
    eq(shiftAssignments.employeeId, ownerEmployeeId),
    eq(shiftAssignments.id, assignmentId),
    ne(shiftAssignments.status, "cancelled"),
  );
}

async function ownerAssignment(
  tx: DraftTx,
  organizationId: string,
  ownerUserId: string,
  ownerEmployeeId: string,
  assignmentId: string,
) {
  const rows = await tx
    .select({ id: shiftAssignments.id })
    .from(shiftAssignments)
    .innerJoin(employees, eq(shiftAssignments.employeeId, employees.id))
    .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
    .innerJoin(posts, eq(shifts.postId, posts.id))
    .innerJoin(sites, eq(posts.siteId, sites.id))
    .innerJoin(clients, eq(sites.clientId, clients.id))
    .where(
      ownerPredicate(
        organizationId,
        ownerUserId,
        ownerEmployeeId,
        assignmentId,
      ),
    )
    .for("update")
    .limit(1);
  if (!rows[0]) throw new ResourceNotFoundError("Reporting draft");
}

export async function lockDraftForFinalization(
  tx: DraftTx,
  draft: DraftFinalization,
) {
  await ownerAssignment(
    tx,
    draft.organizationId,
    draft.ownerUserId,
    draft.ownerEmployeeId,
    draft.shiftAssignmentId,
  );
  const rows = await tx
    .select()
    .from(reportingDrafts)
    .where(
      and(
        eq(reportingDrafts.id, draft.id),
        eq(reportingDrafts.organizationId, draft.organizationId),
        eq(reportingDrafts.ownerUserId, draft.ownerUserId),
        eq(reportingDrafts.ownerEmployeeId, draft.ownerEmployeeId),
        eq(reportingDrafts.shiftAssignmentId, draft.shiftAssignmentId),
        eq(reportingDrafts.family, draft.family),
      ),
    )
    .for("update")
    .limit(1);
  const row = rows[0];
  if (!row) throw new ResourceNotFoundError("Reporting draft");
  if (
    row.disposition !== "ACTIVE" ||
    row.expiresAt <= new Date() ||
    row.revision !== draft.revision ||
    row.submissionKey !== draft.submissionKey
  )
    throw new StaleUpdateError();
}

export async function retireSubmittedDraft(
  tx: DraftTx,
  draft: DraftFinalization,
  canonicalRecordId: string,
  audit: AuditContext,
) {
  const now = new Date();
  await tx
    .update(reportingDrafts)
    .set({
      payload: {},
      disposition: "SUBMITTED",
      canonicalRecordId,
      disposedAt: now,
      updatedAt: now,
    })
    .where(eq(reportingDrafts.id, draft.id));
  await tx.insert(auditEvents).values({
    organizationId: audit.organizationId,
    actorUserId: audit.actorUserId,
    action: "reporting-draft.submitted",
    entityType: "ReportingDraft",
    entityId: draft.id,
    requestId: audit.requestId,
    sessionId: audit.sessionId,
    afterState: { family: draft.family, disposition: "SUBMITTED" },
  });
}

export class PostgresReportingDraftRepository {
  constructor(private readonly database: NexusDatabase) {}

  async get(
    organizationId: string,
    ownerUserId: string,
    ownerEmployeeId: string,
    assignmentId: string,
    family: DraftFamily,
  ) {
    const rows = await this.database
      .select({ draft: reportingDrafts })
      .from(reportingDrafts)
      .innerJoin(
        shiftAssignments,
        eq(reportingDrafts.shiftAssignmentId, shiftAssignments.id),
      )
      .innerJoin(employees, eq(shiftAssignments.employeeId, employees.id))
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(
        and(
          ownerPredicate(
            organizationId,
            ownerUserId,
            ownerEmployeeId,
            assignmentId,
          ),
          eq(reportingDrafts.ownerUserId, ownerUserId),
          eq(reportingDrafts.ownerEmployeeId, ownerEmployeeId),
          eq(reportingDrafts.organizationId, organizationId),
          eq(reportingDrafts.family, family),
          eq(reportingDrafts.disposition, "ACTIVE"),
          sql`${reportingDrafts.expiresAt} > now()`,
        ),
      )
      .limit(1);
    return rows[0] ? dto(rows[0].draft) : null;
  }

  async getById(
    organizationId: string,
    ownerUserId: string,
    ownerEmployeeId: string,
    assignmentId: string,
    id: string,
  ) {
    const rows = await this.database
      .select({ draft: reportingDrafts })
      .from(reportingDrafts)
      .innerJoin(
        shiftAssignments,
        eq(reportingDrafts.shiftAssignmentId, shiftAssignments.id),
      )
      .innerJoin(employees, eq(shiftAssignments.employeeId, employees.id))
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .innerJoin(posts, eq(shifts.postId, posts.id))
      .innerJoin(sites, eq(posts.siteId, sites.id))
      .innerJoin(clients, eq(sites.clientId, clients.id))
      .where(
        and(
          ownerPredicate(
            organizationId,
            ownerUserId,
            ownerEmployeeId,
            assignmentId,
          ),
          eq(reportingDrafts.id, id),
          eq(reportingDrafts.ownerUserId, ownerUserId),
          eq(reportingDrafts.organizationId, organizationId),
          eq(reportingDrafts.ownerEmployeeId, ownerEmployeeId),
        ),
      )
      .limit(1);
    return rows[0] ? dto(rows[0].draft) : null;
  }

  async save(
    input: {
      organizationId: string;
      ownerUserId: string;
      ownerEmployeeId: string;
      assignmentId: string;
      family: DraftFamily;
      clientDraftKey: string;
      submissionKey: string;
      saveKey: string;
      expectedRevision: number;
      payload: Record<string, unknown>;
    },
    audit: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      await ownerAssignment(
        tx,
        input.organizationId,
        input.ownerUserId,
        input.ownerEmployeeId,
        input.assignmentId,
      );
      const rows = await tx
        .select()
        .from(reportingDrafts)
        .where(
          and(
            eq(reportingDrafts.organizationId, input.organizationId),
            eq(reportingDrafts.ownerUserId, input.ownerUserId),
            eq(reportingDrafts.ownerEmployeeId, input.ownerEmployeeId),
            eq(reportingDrafts.shiftAssignmentId, input.assignmentId),
            eq(reportingDrafts.family, input.family),
            eq(reportingDrafts.disposition, "ACTIVE"),
          ),
        )
        .for("update")
        .limit(1);
      let existing: (typeof rows)[number] | undefined = rows[0];
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (existing?.expiresAt && existing.expiresAt <= now) {
        await tx
          .update(reportingDrafts)
          .set({
            payload: {},
            disposition: "EXPIRED",
            disposedAt: now,
            updatedAt: now,
          })
          .where(eq(reportingDrafts.id, existing.id));
        await tx.insert(auditEvents).values({
          organizationId: input.organizationId,
          action: "reporting-draft.expired",
          entityType: "ReportingDraft",
          entityId: existing.id,
          requestId: audit.requestId,
          sessionId: audit.sessionId,
          afterState: { family: input.family, disposition: "EXPIRED" },
        });
        existing = undefined;
      }
      if (existing) {
        if (existing.clientDraftKey !== input.clientDraftKey)
          throw new StaleUpdateError();
        if (existing.lastSaveKey === input.saveKey) {
          if (!isDeepStrictEqual(existing.payload, input.payload))
            throw new StaleUpdateError();
          return dto(existing);
        }
        if (
          existing.revision !== input.expectedRevision ||
          existing.submissionKey !== input.submissionKey
        )
          throw new StaleUpdateError();
        const updated = await tx
          .update(reportingDrafts)
          .set({
            payload: input.payload,
            revision: existing.revision + 1,
            lastSaveKey: input.saveKey,
            updatedAt: now,
            expiresAt,
          })
          .where(eq(reportingDrafts.id, existing.id))
          .returning();
        await this.audit(tx, audit, existing.id, input.family, "saved");
        return dto(updated[0]!);
      }
      if (input.expectedRevision !== 0) throw new StaleUpdateError();
      const inserted = await tx
        .insert(reportingDrafts)
        .values({
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          ownerEmployeeId: input.ownerEmployeeId,
          shiftAssignmentId: input.assignmentId,
          family: input.family,
          clientDraftKey: input.clientDraftKey,
          submissionKey: input.submissionKey,
          lastSaveKey: input.saveKey,
          payload: input.payload,
          expiresAt,
        })
        .onConflictDoNothing()
        .returning();
      if (!inserted[0]) throw new StaleUpdateError();
      await this.audit(tx, audit, inserted[0].id, input.family, "created");
      return dto(inserted[0]);
    });
  }

  async discard(
    organizationId: string,
    ownerUserId: string,
    ownerEmployeeId: string,
    assignmentId: string,
    id: string,
    expectedRevision: number,
    audit: AuditContext,
  ) {
    return this.database.transaction(async (tx) => {
      await ownerAssignment(
        tx,
        organizationId,
        ownerUserId,
        ownerEmployeeId,
        assignmentId,
      );
      const rows = await tx
        .select()
        .from(reportingDrafts)
        .where(
          and(
            eq(reportingDrafts.id, id),
            eq(reportingDrafts.organizationId, organizationId),
            eq(reportingDrafts.ownerUserId, ownerUserId),
            eq(reportingDrafts.ownerEmployeeId, ownerEmployeeId),
            eq(reportingDrafts.shiftAssignmentId, assignmentId),
          ),
        )
        .for("update")
        .limit(1);
      const row = rows[0];
      if (!row) throw new ResourceNotFoundError("Reporting draft");
      if (row.disposition !== "ACTIVE" || row.revision !== expectedRevision)
        throw new StaleUpdateError();
      const now = new Date();
      await tx
        .update(reportingDrafts)
        .set({
          payload: {},
          disposition: "DISCARDED",
          disposedAt: now,
          updatedAt: now,
        })
        .where(eq(reportingDrafts.id, id));
      await this.audit(tx, audit, id, row.family as DraftFamily, "discarded");
    });
  }

  async expireBatch(limit = 100) {
    return this.database.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: reportingDrafts.id,
          organizationId: reportingDrafts.organizationId,
          ownerUserId: reportingDrafts.ownerUserId,
          family: reportingDrafts.family,
        })
        .from(reportingDrafts)
        .where(
          and(
            eq(reportingDrafts.disposition, "ACTIVE"),
            lt(reportingDrafts.expiresAt, new Date()),
          ),
        )
        .orderBy(reportingDrafts.expiresAt, reportingDrafts.id)
        .for("update", { skipLocked: true })
        .limit(Math.min(Math.max(limit, 1), 100));
      const now = new Date();
      for (const row of rows) {
        await tx
          .update(reportingDrafts)
          .set({
            payload: {},
            disposition: "EXPIRED",
            disposedAt: now,
            updatedAt: now,
          })
          .where(eq(reportingDrafts.id, row.id));
        await tx.insert(auditEvents).values({
          organizationId: row.organizationId,
          action: "reporting-draft.expired",
          entityType: "ReportingDraft",
          entityId: row.id,
          afterState: { family: row.family, disposition: "EXPIRED" },
        });
      }
      return rows.length;
    });
  }

  private async audit(
    tx: DraftTx,
    audit: AuditContext,
    id: string,
    family: DraftFamily,
    action: "created" | "saved" | "discarded",
  ) {
    await tx.insert(auditEvents).values({
      organizationId: audit.organizationId,
      actorUserId: audit.actorUserId,
      action: `reporting-draft.${action}`,
      entityType: "ReportingDraft",
      entityId: id,
      requestId: audit.requestId,
      sessionId: audit.sessionId,
      afterState: {
        family,
        disposition: action === "discarded" ? "DISCARDED" : "ACTIVE",
      },
    });
  }
}
