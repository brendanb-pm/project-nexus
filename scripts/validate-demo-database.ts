import { existsSync } from "node:fs";
import { Pool } from "pg";

function testDatabaseUrl() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required.");
  const url = new URL(value);
  if (
    process.env.NEXUS_ISOLATED_TEST_DATABASE !== "true" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !/^\/nexus_[a-z0-9_]+_test$/.test(url.pathname)
  ) {
    throw new Error(
      "Demo validation requires an isolated local test database.",
    );
  }
  return value;
}

async function main() {
  const pool = new Pool({ connectionString: testDatabaseUrl() });
  try {
    const marker = await pool.query<{ marker: string }>(
      "SELECT marker FROM nexus_local_environment_identity WHERE singleton = true",
    );
    if (marker.rows[0]?.marker !== "NEXUS_LOCAL_DEMO_V1") {
      throw new Error("Database is not a marked Nexus disposable demo target.");
    }

    const failures: string[] = [];
    const requiredTables = [
      "activity_entries",
      "end_of_shift_reports",
      "incident_reports",
      "reporting_drafts",
      "reporting_exceptions",
      "reporting_exception_events",
    ];
    const tables = await pool.query<{ name: string | null }>(
      "SELECT to_regclass('public.' || name)::text AS name FROM unnest($1::text[]) AS name",
      [requiredTables],
    );
    requiredTables.forEach((name, index) => {
      if (!tables.rows[index]?.name) failures.push(`missing table: ${name}`);
    });
    async function expectCount(label: string, query: string, minimum: number) {
      const result = await pool.query<{ count: string }>(query);
      const count = Number(result.rows[0]?.count ?? 0);
      if (count < minimum) failures.push(`${label}: ${count} < ${minimum}`);
      return count;
    }

    const branches = await expectCount(
      "branches",
      "SELECT count(*) FROM branches",
      2,
    );
    const clients = await expectCount(
      "clients",
      "SELECT count(*) FROM clients",
      2,
    );
    const sites = await expectCount("sites", "SELECT count(*) FROM sites", 4);
    await expectCount(
      "seven authenticated personas",
      "SELECT count(DISTINCT ei.subject) FROM external_identities ei JOIN users u ON u.id = ei.user_id JOIN user_memberships m ON m.user_id = u.id AND m.organization_id = u.organization_id AND m.status = 'active' WHERE ei.issuer = 'local-dev://nexus' AND u.status = 'active' AND ei.subject IN ('guard-a', 'guard-b', 'operations-manager-b', 'supervisor-a', 'client-user-a', 'leadership-a', 'admin-a')",
      7,
    );
    await expectCount(
      "two incident classes",
      "SELECT count(DISTINCT classification) FROM incident_reports WHERE status <> 'DRAFT'",
      2,
    );
    await expectCount(
      "two incident severities",
      "SELECT count(DISTINCT severity) FROM incident_reports WHERE status <> 'DRAFT'",
      2,
    );
    await expectCount(
      "client-visible report",
      "SELECT count(*) FROM incident_reports WHERE visibility = 'CLIENT_VISIBLE' AND status = 'SUBMITTED'",
      1,
    );
    await expectCount(
      "internal-only report",
      "SELECT count(*) FROM incident_reports WHERE visibility = 'INTERNAL' AND status = 'SUBMITTED'",
      1,
    );
    await expectCount(
      "linked reportable activity",
      "SELECT count(*) FROM activity_entries a JOIN incident_reports i ON i.originating_activity_entry_id = a.id WHERE a.category = 'REPORTABLE_INCIDENT' AND a.incident_gate = 'REQUIRED' AND i.status = 'SUBMITTED'",
      1,
    );
    await expectCount(
      "worked assignments",
      "SELECT count(DISTINCT shift_assignment_id) FROM clock_events WHERE event_type = 'CLOCK_IN'",
      2,
    );
    await expectCount(
      "late unresolved obligations",
      "SELECT count(*) FROM reporting_exceptions WHERE classification = 'LATE' AND state = 'OPEN'",
      1,
    );
    await expectCount(
      "missing unresolved obligations",
      "SELECT count(*) FROM reporting_exceptions WHERE classification = 'MISSING' AND state = 'OPEN'",
      1,
    );
    await expectCount(
      "corrected pending review obligations",
      "SELECT count(*) FROM reporting_exceptions WHERE state = 'CORRECTED_PENDING_REVIEW' AND corrected_at IS NOT NULL",
      1,
    );
    const checks: Array<[string, string]> = [
      [
        "overlapping employee assignments",
        "SELECT count(*) FROM shift_assignments a JOIN shifts sa ON sa.id = a.shift_id JOIN shift_assignments b ON b.employee_id = a.employee_id AND b.id > a.id JOIN shifts sb ON sb.id = b.shift_id WHERE a.status <> 'cancelled' AND b.status <> 'cancelled' AND sa.status <> 'CANCELLED' AND sb.status <> 'CANCELLED' AND sa.scheduled_start < sb.scheduled_end AND sb.scheduled_start < sa.scheduled_end",
      ],
      [
        "cross-organization or cross-branch sites",
        "SELECT count(*) FROM sites s JOIN clients c ON c.id = s.client_id JOIN branches b ON b.id = c.branch_id WHERE c.organization_id <> b.organization_id",
      ],
      [
        "cross-site assignment incidents",
        "SELECT count(*) FROM incident_reports i JOIN shift_assignments a ON a.id = i.shift_assignment_id JOIN shifts sh ON sh.id = a.shift_id JOIN posts p ON p.id = sh.post_id WHERE i.site_id <> p.site_id",
      ],
      [
        "events after scheduled end or before start",
        "SELECT count(*) FROM clock_events e JOIN shift_assignments a ON a.id = e.shift_assignment_id JOIN shifts s ON s.id = a.shift_id WHERE e.effective_at < s.scheduled_start OR e.effective_at > s.scheduled_end",
      ],
      [
        "exception state without matching latest immutable event",
        "SELECT count(*) FROM reporting_exceptions e LEFT JOIN LATERAL (SELECT next_state FROM reporting_exception_events ev WHERE ev.reporting_exception_id = e.id ORDER BY ev.occurred_at DESC, ev.id DESC LIMIT 1) latest ON true WHERE latest.next_state IS DISTINCT FROM e.state",
      ],
      [
        "contradictory corrected obligation state",
        "SELECT count(*) FROM reporting_exceptions WHERE (state = 'CORRECTED_PENDING_REVIEW' AND corrected_at IS NULL) OR (state = 'OPEN' AND corrected_at IS NOT NULL)",
      ],
    ];
    for (const [label, query] of checks) {
      const count = Number(
        (await pool.query<{ count: string }>(query)).rows[0]?.count ?? 0,
      );
      if (count !== 0) failures.push(`${label}: ${count}`);
    }
    if (failures.length)
      throw new Error(`Demo data invalid: ${failures.join("; ")}`);
    console.log(
      `Demo database validated: ${branches} branches, ${clients} clients, ${sites} sites; no assignment overlap or scope mismatch.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
