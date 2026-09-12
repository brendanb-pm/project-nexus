import { existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresAssetRepository } from "@/features/assets/postgres-repository";
import { assetCheckoutEvents, assets, auditEvents } from "@/server/db/schema";
import * as schema from "@/server/db/schema";

const enabled = process.env.NEXUS_POSTGRES_TEST === "true";
const suite = enabled ? describe.sequential : describe.skip;
const ids = {
  organization: "00000000-0000-4000-8000-000000000001",
  branch: "00000000-0000-4000-8000-000000000010",
  site: "00000000-0000-4000-8000-000000000030",
  otherSite: "00000000-0000-4000-8000-000000000031",
  actor: "00000000-0000-4000-8000-000000000052",
  employeeA: "00000000-0000-4000-8000-000000000060",
  employeeB: "00000000-0000-4000-8000-000000000061",
  asset: "00000000-0000-4000-8000-000000000163",
} as const;
const scope = {
  organizationId: ids.organization,
  organizationWide: true,
  branchIds: [] as string[],
  clientIds: [] as string[],
  siteIds: [] as string[],
};
const branchScope = {
  ...scope,
  organizationWide: false,
  branchIds: [ids.branch],
};
const audit = {
  actorUserId: ids.actor,
  organizationId: ids.organization,
  requestId: "asset-custody-postgres-test",
};

suite("NX-6.3 PostgreSQL custody invariants", () => {
  let pool: Pool;
  let database: ReturnType<typeof drizzle<typeof schema>>;
  let repository: PostgresAssetRepository;

  async function resetAsset() {
    await database
      .delete(auditEvents)
      .where(
        and(
          eq(auditEvents.entityType, "Asset"),
          eq(auditEvents.entityId, ids.asset),
        ),
      );
    await database
      .delete(assetCheckoutEvents)
      .where(eq(assetCheckoutEvents.assetId, ids.asset));
    await database.delete(assets).where(eq(assets.id, ids.asset));
    await database.insert(assets).values({
      id: ids.asset,
      organizationId: ids.organization,
      identifier: "NX63-RACE-163",
      assetType: "radio",
      status: "active",
      condition: "good",
      assignedSiteId: ids.site,
    });
  }
  async function prepareFixture() {
    await pool.query(
      "insert into organizations (id, name, status) values ($1, 'NX-6.3 Test Organization', 'active') on conflict (id) do nothing",
      [ids.organization],
    );
    await pool.query(
      "insert into branches (id, organization_id, name, timezone, status) values ($1, $2, 'NX-6.3 Test Branch', 'America/Los_Angeles', 'active') on conflict (id) do nothing",
      [ids.branch, ids.organization],
    );
    await pool.query(
      "insert into clients (id, organization_id, branch_id, name, status) values ('00000000-0000-4000-8000-000000000020', $1, $2, 'NX-6.3 Test Client', 'active') on conflict (id) do nothing",
      [ids.organization, ids.branch],
    );
    await pool.query(
      "insert into sites (id, client_id, name, address, timezone, active) values ($1, '00000000-0000-4000-8000-000000000020', 'NX-6.3 Site A', '{\"line1\":\"1 Test Way\"}'::jsonb, 'America/Los_Angeles', true), ($2, '00000000-0000-4000-8000-000000000020', 'NX-6.3 Site B', '{\"line1\":\"2 Test Way\"}'::jsonb, 'America/Los_Angeles', true) on conflict (id) do nothing",
      [ids.site, ids.otherSite],
    );
    await pool.query(
      "insert into users (id, organization_id, email, status) values ($1, $2, 'nx63-actor@example.invalid', 'active') on conflict (id) do nothing",
      [ids.actor, ids.organization],
    );
    await pool.query(
      "insert into employees (id, organization_id, employee_number, employment_status, primary_branch_id, profile) values ($1, $3, 'NX63-A', 'active', $4, '{\"name\":\"NX-6.3 Guard A\"}'::jsonb), ($2, $3, 'NX63-B', 'active', $4, '{\"name\":\"NX-6.3 Guard B\"}'::jsonb) on conflict (id) do nothing",
      [ids.employeeA, ids.employeeB, ids.organization, ids.branch],
    );
  }
  async function counts() {
    const events = await database
      .select({ id: assetCheckoutEvents.id })
      .from(assetCheckoutEvents)
      .where(eq(assetCheckoutEvents.assetId, ids.asset));
    const audits = await database
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.entityType, "Asset"),
          eq(auditEvents.entityId, ids.asset),
        ),
      );
    return { events, audits };
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL && existsSync(".env.local"))
      process.loadEnvFile(".env.local");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
    database = drizzle(pool, { schema });
    repository = new PostgresAssetRepository(database);
    await prepareFixture();
    await resetAsset();
  });
  afterAll(async () => {
    if (!database || !pool) return;
    await database
      .delete(auditEvents)
      .where(
        and(
          eq(auditEvents.entityType, "Asset"),
          eq(auditEvents.entityId, ids.asset),
        ),
      );
    await database
      .delete(assetCheckoutEvents)
      .where(eq(assetCheckoutEvents.assetId, ids.asset));
    await database.delete(assets).where(eq(assets.id, ids.asset));
    await pool.end();
  });

  it("permits exactly one explicitly overlapping checkout and leaves no losing artifacts", async () => {
    await resetAsset();
    const initial = await repository.get(scope, ids.asset);
    expect(initial).not.toBeNull();
    const gate = await pool.connect();
    await gate.query("begin");
    await gate.query("select id from assets where id = $1 for update", [
      ids.asset,
    ]);
    const first = repository.custody(
      scope,
      ids.asset,
      { action: "CHECKOUT", employeeId: ids.employeeA, reason: "Start shift" },
      initial!.updatedAt,
      audit,
    );
    const second = repository.custody(
      scope,
      ids.asset,
      {
        action: "CHECKOUT",
        employeeId: ids.employeeB,
        reason: "Competing request",
      },
      initial!.updatedAt,
      audit,
    );
    await new Promise((resolve) => setTimeout(resolve, 75));
    await gate.query("commit");
    gate.release();
    const outcomes = await Promise.allSettled([first, second]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "rejected"),
    ).toHaveLength(1);
    const finalAsset = await repository.get(scope, ids.asset);
    expect(finalAsset?.siteId).toBeUndefined();
    const result = await counts();
    expect(result.events).toHaveLength(1);
    expect(result.audits).toHaveLength(1);
  });

  it("rolls back invalid destinations without changing projection, version, event, or audit", async () => {
    await resetAsset();
    const initial = await repository.get(scope, ids.asset);
    await expect(
      repository.custody(
        branchScope,
        ids.asset,
        {
          action: "CHECKOUT",
          employeeId: "00000000-0000-4000-8000-000000000063",
          reason: "Forbidden",
        },
        initial!.updatedAt,
        audit,
      ),
    ).rejects.toThrow("active employee");
    expect(await repository.get(scope, ids.asset)).toEqual(initial);
    expect(await counts()).toEqual({ events: [], audits: [] });

    const checkedOut = await repository.custody(
      scope,
      ids.asset,
      { action: "CHECKOUT", employeeId: ids.employeeA, reason: "Valid issue" },
      initial!.updatedAt,
      audit,
    );
    expect(checkedOut).not.toBeNull();
    if (!checkedOut)
      throw new Error("Checkout unexpectedly returned no asset.");
    const beforeInvalidSite = await repository.get(scope, ids.asset);
    const beforeCounts = await counts();
    await expect(
      repository.custody(
        scope,
        ids.asset,
        {
          action: "CHECKIN",
          siteId: "00000000-0000-4000-8000-000000000999",
          reason: "Forbidden site",
        },
        checkedOut.updatedAt,
        audit,
      ),
    ).rejects.toThrow("authorized return site");
    expect(await repository.get(scope, ids.asset)).toEqual(beforeInvalidSite);
    expect(await counts()).toEqual(beforeCounts);
  });

  it("rolls back the projection and event when the audit write fails after custody processing begins", async () => {
    await resetAsset();
    const initial = await repository.get(scope, ids.asset);
    const checkedOut = await repository.custody(
      scope,
      ids.asset,
      { action: "CHECKOUT", employeeId: ids.employeeA, reason: "Valid issue" },
      initial!.updatedAt,
      audit,
    );
    expect(checkedOut).not.toBeNull();
    if (!checkedOut)
      throw new Error("Checkout unexpectedly returned no asset.");
    const beforeFailure = await repository.get(scope, ids.asset);
    const beforeCounts = await counts();
    await pool.query(`
      create or replace function nx63_fail_custody_audit() returns trigger as $$
      begin
        if new.action = 'asset.custody.checkin' then
          raise exception 'controlled NX-6.3 audit failure';
        end if;
        return new;
      end;
      $$ language plpgsql;
      create trigger nx63_fail_custody_audit_trigger before insert on audit_events
      for each row execute function nx63_fail_custody_audit();
    `);
    try {
      await expect(
        repository.custody(
          scope,
          ids.asset,
          { action: "CHECKIN", siteId: ids.site, reason: "Return radio" },
          checkedOut.updatedAt,
          audit,
        ),
      ).rejects.toThrow("Failed query");
    } finally {
      await pool.query(
        "drop trigger if exists nx63_fail_custody_audit_trigger on audit_events; drop function if exists nx63_fail_custody_audit()",
      );
    }
    expect(await repository.get(scope, ids.asset)).toEqual(beforeFailure);
    expect(await counts()).toEqual(beforeCounts);
  });

  it("preserves append-only prior custody, reason, and condition across checkout and check-in", async () => {
    await resetAsset();
    const initial = await repository.get(scope, ids.asset);
    const checkedOut = await repository.custody(
      scope,
      ids.asset,
      {
        action: "CHECKOUT",
        employeeId: ids.employeeA,
        reason: "Issue radio",
        condition: "fair",
      },
      initial!.updatedAt,
      audit,
    );
    expect(checkedOut).not.toBeNull();
    if (!checkedOut)
      throw new Error("Checkout unexpectedly returned no asset.");
    expect(checkedOut.siteId).toBeUndefined();
    const checkedIn = await repository.custody(
      scope,
      ids.asset,
      {
        action: "CHECKIN",
        siteId: ids.otherSite,
        reason: "Return radio",
        condition: "good",
      },
      checkedOut.updatedAt,
      audit,
    );
    expect(checkedIn).not.toBeNull();
    if (!checkedIn) throw new Error("Check-in unexpectedly returned no asset.");
    expect(checkedIn.siteId).toBe(ids.otherSite);
    const events = await database
      .select()
      .from(assetCheckoutEvents)
      .where(eq(assetCheckoutEvents.assetId, ids.asset))
      .orderBy(assetCheckoutEvents.occurredAt, assetCheckoutEvents.id);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      previousEmployeeId: null,
      previousSiteId: ids.site,
      employeeId: ids.employeeA,
      reason: "Issue radio",
      condition: "fair",
    });
    expect(events[1]).toMatchObject({
      previousEmployeeId: ids.employeeA,
      previousSiteId: null,
      siteId: ids.otherSite,
      reason: "Return radio",
      condition: "good",
    });
    expect((await counts()).audits).toHaveLength(2);
  });
});
