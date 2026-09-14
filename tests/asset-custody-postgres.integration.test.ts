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
  otherBranch: "00000000-0000-4000-8000-000000000011",
  site: "00000000-0000-4000-8000-000000000030",
  otherSite: "00000000-0000-4000-8000-000000000031",
  unauthorizedSite: "00000000-0000-4000-8000-000000000032",
  actor: "00000000-0000-4000-8000-000000000052",
  employeeA: "00000000-0000-4000-8000-000000000060",
  employeeB: "00000000-0000-4000-8000-000000000061",
  unauthorizedEmployee: "00000000-0000-4000-8000-000000000063",
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
      "insert into branches (id, organization_id, name, timezone, status) values ($1, $2, 'NX-6.3 Other Branch', 'America/Los_Angeles', 'active') on conflict (id) do nothing",
      [ids.otherBranch, ids.organization],
    );
    await pool.query(
      "insert into clients (id, organization_id, branch_id, name, status) values ('00000000-0000-4000-8000-000000000020', $1, $2, 'NX-6.3 Test Client', 'active') on conflict (id) do nothing",
      [ids.organization, ids.branch],
    );
    await pool.query(
      "insert into clients (id, organization_id, branch_id, name, status) values ('00000000-0000-4000-8000-000000000021', $1, $2, 'NX-6.3 Other Client', 'active') on conflict (id) do nothing",
      [ids.organization, ids.otherBranch],
    );
    await pool.query(
      "insert into sites (id, client_id, name, address, timezone, active) values ($1, '00000000-0000-4000-8000-000000000020', 'NX-6.3 Site A', '{\"line1\":\"1 Test Way\"}'::jsonb, 'America/Los_Angeles', true), ($2, '00000000-0000-4000-8000-000000000020', 'NX-6.3 Site B', '{\"line1\":\"2 Test Way\"}'::jsonb, 'America/Los_Angeles', true) on conflict (id) do nothing",
      [ids.site, ids.otherSite],
    );
    await pool.query(
      "insert into sites (id, client_id, name, address, timezone, active) values ($1, '00000000-0000-4000-8000-000000000021', 'NX-6.3 Unauthorized Site', '{\"line1\":\"3 Test Way\"}'::jsonb, 'America/Los_Angeles', true) on conflict (id) do nothing",
      [ids.unauthorizedSite],
    );
    await pool.query(
      "insert into users (id, organization_id, email, status) values ($1, $2, 'nx63-actor@example.invalid', 'active') on conflict (id) do nothing",
      [ids.actor, ids.organization],
    );
    await pool.query(
      "insert into employees (id, organization_id, employee_number, employment_status, primary_branch_id, profile) values ($1, $3, 'NX63-A', 'active', $4, '{\"name\":\"NX-6.3 Guard A\"}'::jsonb), ($2, $3, 'NX63-B', 'active', $4, '{\"name\":\"NX-6.3 Guard B\"}'::jsonb) on conflict (id) do nothing",
      [ids.employeeA, ids.employeeB, ids.organization, ids.branch],
    );
    await pool.query(
      "insert into employees (id, organization_id, employee_number, employment_status, primary_branch_id, profile) values ($1, $2, 'NX63-C', 'active', $3, '{\"name\":\"NX-6.3 Guard C\"}'::jsonb) on conflict (id) do nothing",
      [ids.unauthorizedEmployee, ids.organization, ids.otherBranch],
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
          employeeId: ids.unauthorizedEmployee,
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
        branchScope,
        ids.asset,
        {
          action: "CHECKIN",
          siteId: ids.unauthorizedSite,
          reason: "Forbidden site",
        },
        checkedOut.updatedAt,
        audit,
      ),
    ).rejects.toThrow("authorized active site");
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

  it("supports explicit inventory relocation without permitting silent inventory edits", async () => {
    await resetAsset();
    const initial = await repository.get(scope, ids.asset);
    const relocated = await repository.custody(
      scope,
      ids.asset,
      {
        action: "RELOCATE",
        siteId: ids.otherSite,
        reason: "Move inventory stock",
      },
      initial!.updatedAt,
      audit,
    );
    expect(relocated).toMatchObject({ siteId: ids.otherSite });
    const updated = await repository.update(
      scope,
      ids.asset,
      {
        identifier: "NX63-RACE-163",
        assetType: "radio",
        status: "active",
        condition: "good",
      },
      relocated!.updatedAt,
      audit,
    );
    expect(updated).toMatchObject({ siteId: ids.otherSite });
    const events = await database
      .select()
      .from(assetCheckoutEvents)
      .where(eq(assetCheckoutEvents.assetId, ids.asset));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "RELOCATE",
      previousSiteId: ids.site,
      siteId: ids.otherSite,
      reason: "Move inventory stock",
    });
  });

  it("serializes a transfer racing with check-in and rejects stale replay without residue", async () => {
    await resetAsset();
    const initial = await repository.get(scope, ids.asset);
    const held = await repository.custody(
      scope,
      ids.asset,
      {
        action: "CHECKOUT",
        employeeId: ids.employeeA,
        reason: "Initial issue",
      },
      initial!.updatedAt,
      audit,
    );
    const gate = await pool.connect();
    await gate.query("begin");
    await gate.query("select id from assets where id = $1 for update", [
      ids.asset,
    ]);
    const transfer = repository.custody(
      scope,
      ids.asset,
      { action: "TRANSFER", employeeId: ids.employeeB, reason: "Shift relief" },
      held!.updatedAt,
      audit,
    );
    const checkin = repository.custody(
      scope,
      ids.asset,
      { action: "CHECKIN", siteId: ids.site, reason: "End shift" },
      held!.updatedAt,
      audit,
    );
    await new Promise((resolve) => setTimeout(resolve, 75));
    await gate.query("commit");
    gate.release();
    const outcomes = await Promise.allSettled([transfer, checkin]);
    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const afterRace = await repository.get(scope, ids.asset);
    const afterRaceCounts = await counts();
    expect(afterRaceCounts.events).toHaveLength(2);
    expect(afterRaceCounts.audits).toHaveLength(2);
    expect(Boolean(afterRace?.employeeId) !== Boolean(afterRace?.siteId)).toBe(
      true,
    );
    await expect(
      repository.custody(
        branchScope,
        ids.asset,
        { action: "CHECKIN", siteId: ids.site, reason: "Stale replay" },
        held!.updatedAt,
        audit,
      ),
    ).rejects.toThrow();
    expect(await counts()).toEqual(afterRaceCounts);
  });

  it("keeps deactivated-employee custody visible and permits an explicit return", async () => {
    await resetAsset();
    const initial = await repository.get(scope, ids.asset);
    const held = await repository.custody(
      scope,
      ids.asset,
      {
        action: "CHECKOUT",
        employeeId: ids.employeeA,
        reason: "Issue before deactivation",
      },
      initial!.updatedAt,
      audit,
    );
    await pool.query(
      "update employees set employment_status = 'inactive' where id = $1",
      [ids.employeeA],
    );
    try {
      expect(await repository.get(branchScope, ids.asset)).toMatchObject({
        employeeId: ids.employeeA,
      });
      expect(
        (await repository.get(branchScope, ids.asset))?.employeeName,
      ).toBeTruthy();
      const returned = await repository.custody(
        branchScope,
        ids.asset,
        {
          action: "CHECKIN",
          siteId: ids.site,
          reason: "Recover from inactive employee",
        },
        held!.updatedAt,
        audit,
      );
      expect(returned).toMatchObject({ siteId: ids.site });
      expect((await counts()).events).toHaveLength(2);
    } finally {
      await pool.query(
        "update employees set employment_status = 'active' where id = $1",
        [ids.employeeA],
      );
    }
  });

  it("allows decommissioned custody to be resolved but blocks new custody", async () => {
    await resetAsset();
    const initial = await repository.get(scope, ids.asset);
    const held = await repository.custody(
      scope,
      ids.asset,
      { action: "CHECKOUT", employeeId: ids.employeeA, reason: "Issue asset" },
      initial!.updatedAt,
      audit,
    );
    const retiredUpdate = await repository.update(
      scope,
      ids.asset,
      {
        identifier: "NX63-RACE-163",
        assetType: "radio",
        status: "retired",
        condition: "good",
      },
      held!.updatedAt,
      audit,
    );
    expect(retiredUpdate).toMatchObject({
      status: "retired",
      employeeId: ids.employeeA,
    });
    const retired = await repository.get(scope, ids.asset);
    await expect(
      repository.custody(
        branchScope,
        ids.asset,
        {
          action: "TRANSFER",
          employeeId: ids.employeeB,
          reason: "Invalid transfer",
        },
        retired!.updatedAt,
        audit,
      ),
    ).rejects.toThrow("not available");
    const returned = await repository.custody(
      scope,
      ids.asset,
      {
        action: "CHECKIN",
        siteId: ids.site,
        reason: "Resolve retired custody",
      },
      retired!.updatedAt,
      audit,
    );
    expect(returned).toMatchObject({ status: "retired", siteId: ids.site });
    expect((await counts()).events).toHaveLength(2);
  });

  it("fails closed for a cross-tenant repository mutation", async () => {
    await resetAsset();
    const initial = await repository.get(scope, ids.asset);
    const result = await repository.custody(
      { ...scope, organizationId: "00000000-0000-4000-8000-000000000099" },
      ids.asset,
      {
        action: "CHECKOUT",
        employeeId: ids.employeeA,
        reason: "Forged tenant",
      },
      initial!.updatedAt,
      { ...audit, organizationId: "00000000-0000-4000-8000-000000000099" },
    );
    expect(result).toBeNull();
    expect(await repository.get(scope, ids.asset)).toEqual(initial);
    expect(await counts()).toEqual({ events: [], audits: [] });
  });

  it("enforces a single current custody relationship at the database boundary", async () => {
    await resetAsset();
    await expect(
      pool.query("update assets set assigned_employee_id = $1 where id = $2", [
        ids.employeeA,
        ids.asset,
      ]),
    ).rejects.toThrow("assets_single_custody_projection_check");
    const current = await repository.get(scope, ids.asset);
    expect(current).toMatchObject({ siteId: ids.site });
    expect(current?.employeeId).toBeUndefined();
  });
});
