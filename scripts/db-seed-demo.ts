import { Pool } from "pg";

function localDemoDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required.");
  const url = new URL(value);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/nexus_demo"
  )
    throw new Error(
      "Demo seed refuses non-local or non-nexus_demo DATABASE_URL targets.",
    );
  return value;
}

const ids = {
  organization: "00000000-0000-4000-8000-000000000001",
  branch: "00000000-0000-4000-8000-000000000010",
  client: "00000000-0000-4000-8000-000000000020",
  site: "00000000-0000-4000-8000-000000000030",
  post: "00000000-0000-4000-8000-000000000040",
  guardUser: "00000000-0000-4000-8000-000000000050",
  operationsUser: "00000000-0000-4000-8000-000000000052",
  guardEmployee: "00000000-0000-4000-8000-000000000060",
  operationsEmployee: "00000000-0000-4000-8000-000000000062",
  shift: "00000000-0000-4000-8000-000000000080",
  assignment: "00000000-0000-4000-8000-000000000090",
  activity: "00000000-0000-4000-8000-000000000091",
  incident: "00000000-0000-4000-8000-000000000092",
  handoff: "00000000-0000-4000-8000-000000000093",
} as const;

async function main() {
  process.loadEnvFile(".env.local");
  const pool = new Pool({ connectionString: localDemoDatabaseUrl() });
  const now = new Date();
  const startsAt = new Date(now.valueOf() - 60 * 60 * 1000);
  const endsAt = new Date(now.valueOf() + 7 * 60 * 60 * 1000);
  try {
    await pool.query(
      "TRUNCATE TABLE operational_record_revisions, audit_events, handoffs, incident_reports, activity_entries, clock_events, time_records, shift_assignments, shifts, employee_roles, employees, user_memberships, external_identities, users, auth_accounts, auth_sessions, auth_verifications, auth_users, posts, sites, clients, branches, organizations RESTART IDENTITY CASCADE",
    );
    await pool.query(
      "INSERT INTO organizations (id, name, status) VALUES ($1, 'Northstar Protective Services', 'active')",
      [ids.organization],
    );
    await pool.query(
      "INSERT INTO branches (id, organization_id, name, timezone, status) VALUES ($1, $2, 'Northstar Central', 'America/Los_Angeles', 'active')",
      [ids.branch, ids.organization],
    );
    await pool.query(
      "INSERT INTO clients (id, organization_id, branch_id, name, status) VALUES ($1, $2, $3, 'Cedar Plaza', 'active')",
      [ids.client, ids.organization, ids.branch],
    );
    await pool.query(
      'INSERT INTO sites (id, client_id, name, address, timezone) VALUES ($1, $2, \'Cedar Plaza North\', \'{"line1":"100 Cedar Plaza Way","city":"Demo City","region":"CA","postalCode":"90001","country":"US"}\'::jsonb, \'America/Los_Angeles\')',
      [ids.site, ids.client],
    );
    await pool.query(
      "INSERT INTO posts (id, site_id, name, description, service_type, armed_requirement) VALUES ($1, $2, 'North Lobby', 'Synthetic demo access-control post', 'access_control', 'unarmed')",
      [ids.post, ids.site],
    );
    await pool.query(
      "INSERT INTO auth_users (id, name, email, email_verified) VALUES ($1, 'Guard A', 'guard.a@nexus.demo.invalid', true), ($2, 'Operations Manager B', 'operations.b@nexus.demo.invalid', true)",
      ["nexus-dev-auth-guard-a", "nexus-dev-auth-operations-manager-b"],
    );
    await pool.query(
      "INSERT INTO users (id, organization_id, email, status) VALUES ($1, $2, 'guard.a@nexus.demo.invalid', 'active'), ($3, $2, 'operations.b@nexus.demo.invalid', 'active')",
      [ids.guardUser, ids.organization, ids.operationsUser],
    );
    await pool.query(
      "INSERT INTO external_identities (issuer, subject, user_id) VALUES ('local-dev://nexus', 'guard-a', $1), ('local-dev://nexus', 'operations-manager-b', $2)",
      [ids.guardUser, ids.operationsUser],
    );
    await pool.query(
      "INSERT INTO auth_accounts (id, issuer, account_id, provider_id, user_id) VALUES ('nexus-dev-account-guard-a', 'local-dev://nexus', 'guard-a', 'nexus-oidc', 'nexus-dev-auth-guard-a'), ('nexus-dev-account-operations-manager-b', 'local-dev://nexus', 'operations-manager-b', 'nexus-oidc', 'nexus-dev-auth-operations-manager-b')",
    );
    await pool.query(
      "INSERT INTO user_memberships (user_id, organization_id, status) VALUES ($1, $3, 'active'), ($2, $3, 'active')",
      [ids.guardUser, ids.operationsUser, ids.organization],
    );
    await pool.query(
      "INSERT INTO employees (id, organization_id, user_id, employee_number, employment_status, primary_branch_id, profile) VALUES ($1, $3, $4, 'NPS-100', 'active', $5, '{\"name\":\"Guard A\"}'::jsonb), ($2, $3, $6, 'NPS-200', 'active', $5, '{\"name\":\"Operations Manager B\"}'::jsonb)",
      [
        ids.guardEmployee,
        ids.operationsEmployee,
        ids.organization,
        ids.guardUser,
        ids.branch,
        ids.operationsUser,
      ],
    );
    await pool.query(
      "INSERT INTO employee_roles (employee_id, role, branch_id, site_id) VALUES ($1, 'GUARD', $3, $4), ($2, 'OPERATIONS_MANAGER', $3, NULL)",
      [ids.guardEmployee, ids.operationsEmployee, ids.branch, ids.site],
    );
    await pool.query(
      "INSERT INTO shifts (id, post_id, scheduled_start, scheduled_end, status, staffing_requirement, timezone) VALUES ($1, $2, $3, $4, 'PUBLISHED', 1, 'America/Los_Angeles')",
      [ids.shift, ids.post, startsAt, endsAt],
    );
    await pool.query(
      "INSERT INTO shift_assignments (id, shift_id, employee_id, status, assigned_at) VALUES ($1, $2, $3, 'assigned', NOW())",
      [ids.assignment, ids.shift, ids.guardEmployee],
    );
    await pool.query(
      "INSERT INTO activity_entries (id, shift_assignment_id, occurred_at, category, post_id, description, action_taken, follow_up_required, incident_related, incident_gate, submission_key, visibility, status) VALUES ($1, $2, $3, 'OBSERVATION', $4, $5::jsonb, $6, false, false, 'ROUTINE', 'demo-routine-activity', 'INTERNAL', 'SUBMITTED')",
      [
        ids.activity,
        ids.assignment,
        startsAt,
        ids.post,
        JSON.stringify({
          narrative: "Routine north lobby access-control patrol completed.",
          locationContext: "North lobby",
        }),
        "Verified doors, visitor log, and radio status.",
      ],
    );
    await pool.query(
      "INSERT INTO incident_reports (id, site_id, shift_assignment_id, originating_activity_entry_id, reported_by_user_id, incident_number, classification, severity, occurred_at, narrative, actions_taken, emergency_service_involvement, submission_key, status, visibility) VALUES ($1, $2, $3, $4, $5, 'INC-DEMO-0001', 'SECURITY', 'LOW', $6, 'Synthetic demo access-control concern for review.', 'Logged the concern and notified operations.', false, 'demo-incident', 'SUBMITTED', 'INTERNAL')",
      [
        ids.incident,
        ids.site,
        ids.assignment,
        ids.activity,
        ids.guardUser,
        startsAt,
      ],
    );
    await pool.query(
      "INSERT INTO handoffs (id, shift_assignment_id, unresolved_issues, equipment_key_status, follow_up_items, submitted_at, submission_key, status, visibility) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, 'demo-handoff', 'SUBMITTED', 'INTERNAL')",
      [
        ids.handoff,
        ids.assignment,
        JSON.stringify(["Review synthetic access-control concern."]),
        JSON.stringify({
          summary: "North lobby keys and radio accounted for.",
        }),
        JSON.stringify(["Operations acknowledgement pending."]),
        endsAt,
      ],
    );
    console.log("Nexus demo data reset and seeded.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
