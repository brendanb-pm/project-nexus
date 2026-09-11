import { Pool } from "pg";
import { existsSync } from "node:fs";

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
  incompletePost: "00000000-0000-4000-8000-000000000041",
  guardUser: "00000000-0000-4000-8000-000000000050",
  incomingGuardUser: "00000000-0000-4000-8000-000000000051",
  operationsUser: "00000000-0000-4000-8000-000000000052",
  guardEmployee: "00000000-0000-4000-8000-000000000060",
  incomingGuardEmployee: "00000000-0000-4000-8000-000000000061",
  operationsEmployee: "00000000-0000-4000-8000-000000000062",
  shift: "00000000-0000-4000-8000-000000000080",
  assignment: "00000000-0000-4000-8000-000000000090",
  incomingShift: "00000000-0000-4000-8000-000000000081",
  incomingAssignment: "00000000-0000-4000-8000-000000000094",
  incompleteShift: "00000000-0000-4000-8000-000000000082",
  incompleteAssignment: "00000000-0000-4000-8000-000000000097",
  activity: "00000000-0000-4000-8000-000000000091",
  incident: "00000000-0000-4000-8000-000000000092",
  handoff: "00000000-0000-4000-8000-000000000093",
  eosr: "00000000-0000-4000-8000-000000000095",
  timeRecord: "00000000-0000-4000-8000-000000000099",
  coverageNorth: "00000000-0000-4000-8000-000000000070",
  coverageNorthUpcoming: "00000000-0000-4000-8000-000000000071",
  coverageSouth: "00000000-0000-4000-8000-000000000072",
  clockIn: "00000000-0000-4000-8000-000000000073",
  clockOut: "00000000-0000-4000-8000-000000000074",
  guardCardDefinition: "00000000-0000-4000-8000-000000000120",
  cprDefinition: "00000000-0000-4000-8000-000000000121",
  fireWatchDefinition: "00000000-0000-4000-8000-000000000122",
  firstAidDefinition: "00000000-0000-4000-8000-000000000123",
  guardCardCredential: "00000000-0000-4000-8000-000000000124",
  incomingGuardCredential: "00000000-0000-4000-8000-000000000125",
  revokedCredential: "00000000-0000-4000-8000-000000000126",
  expiredCredential: "00000000-0000-4000-8000-000000000127",
} as const;

function localDescriptor(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    time: `${read("hour")}:${read("minute")}:00`,
    weekday: read("weekday").toUpperCase(),
  };
}

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const pool = new Pool({ connectionString: localDemoDatabaseUrl() });
  const now = new Date(Math.floor(Date.now() / 60000) * 60000);
  const startsAt = new Date(now.valueOf() - 7 * 60 * 60 * 1000);
  const endsAt = new Date(now.valueOf() + 60 * 60 * 1000);
  const incomingEndsAt = new Date(now.valueOf() + 9 * 60 * 60 * 1000);
  const incompleteStartsAt = new Date(now.valueOf() - 10 * 60 * 60 * 1000);
  const incompleteEndsAt = new Date(now.valueOf() - 2 * 60 * 60 * 1000);
  const southRequirementEndsAt = new Date(now.valueOf() + 4 * 60 * 60 * 1000);
  const upcomingStartsAt = new Date(now.valueOf() + 10 * 60 * 60 * 1000);
  const upcomingEndsAt = new Date(now.valueOf() + 11 * 60 * 60 * 1000);
  const expiresSoon = localDescriptor(
    new Date(now.valueOf() + 7 * 24 * 60 * 60 * 1000),
  ).date;
  const expiredOn = localDescriptor(
    new Date(now.valueOf() - 3 * 24 * 60 * 60 * 1000),
  ).date;
  try {
    await pool.query(
      "TRUNCATE TABLE eosr_passdown_dismissals, end_of_shift_reports, operational_record_revisions, audit_events, handoffs, incident_reports, activity_entries, clock_events, time_records, shift_assignments, shifts, employee_roles, employees, user_memberships, external_identities, users, auth_accounts, auth_sessions, auth_verifications, auth_users, posts, sites, clients, branches, organizations RESTART IDENTITY CASCADE",
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
      "INSERT INTO posts (id, site_id, name, description, service_type, armed_requirement) VALUES ($1, $2, 'South Gate', 'Synthetic incomplete-close demo post', 'access_control', 'unarmed')",
      [ids.incompletePost, ids.site],
    );
    const northStart = localDescriptor(startsAt);
    const northEnd = localDescriptor(incomingEndsAt);
    const southStart = localDescriptor(incompleteStartsAt);
    const southEnd = localDescriptor(southRequirementEndsAt);
    const upcomingStart = localDescriptor(upcomingStartsAt);
    const upcomingEnd = localDescriptor(upcomingEndsAt);
    await pool.query(
      "INSERT INTO coverage_requirements (id, post_id, required_count, weekdays, local_start_time, local_end_time, effective_start, active) VALUES ($1, $2, 1, $3::jsonb, $4, $5, $6, true), ($7, $2, 1, $8::jsonb, $9, $10, $11, true), ($12, $13, 1, $14::jsonb, $15, $16, $17, true)",
      [
        ids.coverageNorth,
        ids.post,
        JSON.stringify([northStart.weekday]),
        northStart.time,
        northEnd.time,
        northStart.date,
        ids.coverageNorthUpcoming,
        JSON.stringify([upcomingStart.weekday]),
        upcomingStart.time,
        upcomingEnd.time,
        upcomingStart.date,
        ids.coverageSouth,
        ids.incompletePost,
        JSON.stringify([southStart.weekday]),
        southStart.time,
        southEnd.time,
        southStart.date,
      ],
    );
    await pool.query(
      "INSERT INTO auth_users (id, name, email, email_verified) VALUES ($1, 'Guard A', 'guard.a@nexus.demo.invalid', true), ($2, 'Operations Manager B', 'operations.b@nexus.demo.invalid', true), ($3, 'Incoming Guard B', 'guard.b@nexus.demo.invalid', true)",
      [
        "nexus-dev-auth-guard-a",
        "nexus-dev-auth-operations-manager-b",
        "nexus-dev-auth-guard-b",
      ],
    );
    await pool.query(
      "INSERT INTO users (id, organization_id, email, status) VALUES ($1, $2, 'guard.a@nexus.demo.invalid', 'active'), ($3, $2, 'operations.b@nexus.demo.invalid', 'active'), ($4, $2, 'guard.b@nexus.demo.invalid', 'active')",
      [
        ids.guardUser,
        ids.organization,
        ids.operationsUser,
        ids.incomingGuardUser,
      ],
    );
    await pool.query(
      "INSERT INTO external_identities (issuer, subject, user_id) VALUES ('local-dev://nexus', 'guard-a', $1), ('local-dev://nexus', 'operations-manager-b', $2), ('local-dev://nexus', 'guard-b', $3)",
      [ids.guardUser, ids.operationsUser, ids.incomingGuardUser],
    );
    await pool.query(
      "INSERT INTO auth_accounts (id, issuer, account_id, provider_id, user_id) VALUES ('nexus-dev-account-guard-a', 'local-dev://nexus', 'guard-a', 'nexus-oidc', 'nexus-dev-auth-guard-a'), ('nexus-dev-account-operations-manager-b', 'local-dev://nexus', 'operations-manager-b', 'nexus-oidc', 'nexus-dev-auth-operations-manager-b'), ('nexus-dev-account-guard-b', 'local-dev://nexus', 'guard-b', 'nexus-oidc', 'nexus-dev-auth-guard-b')",
    );
    await pool.query(
      "INSERT INTO user_memberships (user_id, organization_id, status) VALUES ($1, $4, 'active'), ($2, $4, 'active'), ($3, $4, 'active')",
      [
        ids.guardUser,
        ids.operationsUser,
        ids.incomingGuardUser,
        ids.organization,
      ],
    );
    await pool.query(
      "INSERT INTO employees (id, organization_id, user_id, employee_number, employment_status, primary_branch_id, profile) VALUES ($1, $4, $5, 'NPS-100', 'active', $6, '{\"name\":\"Guard A\"}'::jsonb), ($2, $4, $7, 'NPS-200', 'active', $6, '{\"name\":\"Operations Manager B\"}'::jsonb), ($3, $4, $8, 'NPS-101', 'active', $6, '{\"name\":\"Incoming Guard B\"}'::jsonb)",
      [
        ids.guardEmployee,
        ids.operationsEmployee,
        ids.incomingGuardEmployee,
        ids.organization,
        ids.guardUser,
        ids.branch,
        ids.operationsUser,
        ids.incomingGuardUser,
      ],
    );
    await pool.query(
      "INSERT INTO employee_roles (employee_id, role, branch_id, site_id) VALUES ($1, 'GUARD', $4, $5), ($2, 'OPERATIONS_MANAGER', $4, NULL), ($3, 'GUARD', $4, $5)",
      [
        ids.guardEmployee,
        ids.operationsEmployee,
        ids.incomingGuardEmployee,
        ids.branch,
        ids.site,
      ],
    );
    await pool.query(
      "INSERT INTO auth_users (id, name, email, email_verified) VALUES ('nexus-dev-auth-client-user-a', 'Client User A', 'client.a@nexus.demo.invalid', true)",
    );
    await pool.query(
      "INSERT INTO users (id, organization_id, email, status) VALUES ($1, $2, 'client.a@nexus.demo.invalid', 'active')",
      ["00000000-0000-4000-8000-000000000130", ids.organization],
    );
    await pool.query(
      "INSERT INTO external_identities (issuer, subject, user_id) VALUES ('local-dev://nexus', 'client-user-a', $1)",
      ["00000000-0000-4000-8000-000000000130"],
    );
    await pool.query(
      "INSERT INTO auth_accounts (id, issuer, account_id, provider_id, user_id) VALUES ('nexus-dev-account-client-user-a', 'local-dev://nexus', 'client-user-a', 'nexus-oidc', 'nexus-dev-auth-client-user-a')",
    );
    await pool.query(
      "INSERT INTO user_memberships (user_id, organization_id, status) VALUES ($1, $2, 'active')",
      ["00000000-0000-4000-8000-000000000130", ids.organization],
    );
    await pool.query(
      "INSERT INTO employees (id, organization_id, user_id, employee_number, employment_status, primary_branch_id, profile) VALUES ($1, $2, $3, 'CLIENT-100', 'active', $4, '{\"name\":\"Client User A\"}'::jsonb)",
      [
        "00000000-0000-4000-8000-000000000131",
        ids.organization,
        "00000000-0000-4000-8000-000000000130",
        ids.branch,
      ],
    );
    await pool.query(
      "INSERT INTO employee_roles (employee_id, role, client_id) VALUES ($1, 'CLIENT_USER', $2)",
      ["00000000-0000-4000-8000-000000000131", ids.client],
    );
    await pool.query(
      "INSERT INTO credential_definitions (id, organization_id, key, display_name, category, jurisdiction_kind, jurisdiction_code, jurisdiction_timezone, expiration_required, verification_required, warning_days, effective_start, active) VALUES ($1, $5, 'ca_guard_card', 'California guard card', 'credential', 'state_province', 'CA', 'America/Los_Angeles', true, true, $6::jsonb, '2020-01-01', true), ($2, $5, 'cpr', 'CPR certification', 'certification', 'organization', NULL, NULL, true, true, $6::jsonb, '2020-01-01', true), ($3, $5, 'fire_watch', 'Fire watch certification', 'certification', 'organization', NULL, NULL, false, true, $6::jsonb, '2020-01-01', true), ($4, $5, 'first_aid', 'First aid certification', 'certification', 'organization', NULL, NULL, true, true, $6::jsonb, '2020-01-01', true)",
      [
        ids.guardCardDefinition,
        ids.cprDefinition,
        ids.fireWatchDefinition,
        ids.firstAidDefinition,
        ids.organization,
        JSON.stringify([60, 30, 14, 7]),
      ],
    );
    await pool.query(
      "INSERT INTO post_credential_requirements (post_id, credential_definition_id, severity, effective_start) VALUES ($1, $3, 'required', '2020-01-01'), ($1, $4, 'required', '2020-01-01'), ($2, $5, 'required', '2020-01-01')",
      [
        ids.post,
        ids.incompletePost,
        ids.guardCardDefinition,
        ids.cprDefinition,
        ids.fireWatchDefinition,
      ],
    );
    await pool.query(
      "INSERT INTO employee_credentials (id, organization_id, employee_id, credential_definition_id, issuer, issued_on, expires_on, state) VALUES ($1, $5, $6, $8, 'California Bureau of Security', '2024-01-01', $9, 'verified'), ($2, $5, $7, $8, 'California Bureau of Security', '2026-01-01', NULL, 'pending_verification'), ($3, $5, $6, $10, 'Nexus Demo', '2024-01-01', NULL, 'revoked'), ($4, $5, $7, $11, 'Nexus Demo', '2024-01-01', $12, 'expired')",
      [
        ids.guardCardCredential,
        ids.incomingGuardCredential,
        ids.revokedCredential,
        ids.expiredCredential,
        ids.organization,
        ids.guardEmployee,
        ids.incomingGuardEmployee,
        ids.guardCardDefinition,
        expiresSoon,
        ids.fireWatchDefinition,
        ids.firstAidDefinition,
        expiredOn,
      ],
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
      "INSERT INTO shifts (id, post_id, scheduled_start, scheduled_end, status, staffing_requirement, timezone) VALUES ($1, $2, $3, $4, 'PUBLISHED', 1, 'America/Los_Angeles')",
      [ids.incomingShift, ids.post, endsAt, incomingEndsAt],
    );
    await pool.query(
      "INSERT INTO shift_assignments (id, shift_id, employee_id, status, assigned_at) VALUES ($1, $2, $3, 'assigned', NOW())",
      [ids.incomingAssignment, ids.incomingShift, ids.incomingGuardEmployee],
    );
    await pool.query(
      "INSERT INTO shifts (id, post_id, scheduled_start, scheduled_end, status, staffing_requirement, timezone) VALUES ($1, $2, $3, $4, 'PUBLISHED', 1, 'America/Los_Angeles')",
      [
        ids.incompleteShift,
        ids.incompletePost,
        incompleteStartsAt,
        incompleteEndsAt,
      ],
    );
    await pool.query(
      "INSERT INTO shift_assignments (id, shift_id, employee_id, status, assigned_at) VALUES ($1, $2, $3, 'assigned', NOW())",
      [ids.incompleteAssignment, ids.incompleteShift, ids.guardEmployee],
    );
    await pool.query(
      "INSERT INTO clock_events (id, shift_assignment_id, event_type, occurred_at, effective_at, recorded_by_user_id, verification_status) VALUES ($1, $2, 'CLOCK_IN', $3, $3, $4, 'NORMAL'), ($5, $2, 'CLOCK_OUT', $6, $6, $4, 'NORMAL')",
      [ids.clockIn, ids.assignment, startsAt, ids.guardUser, ids.clockOut, now],
    );
    await pool.query(
      "INSERT INTO time_records (id, shift_assignment_id, starts_at, ends_at, minutes_worked, seconds_worked, pairs, status, approved_by_user_id, approved_at) VALUES ($1, $2, $3, $4, 420, 25200, $5::jsonb, 'APPROVED', $6, $4)",
      [
        ids.timeRecord,
        ids.assignment,
        startsAt,
        now,
        JSON.stringify([
          { startsAt: startsAt.toISOString(), endsAt: now.toISOString() },
        ]),
        ids.operationsUser,
      ],
    );
    await pool.query(
      "INSERT INTO activity_entries (id, shift_assignment_id, occurred_at, category, post_id, description, action_taken, follow_up_required, incident_related, incident_gate, submission_key, visibility, status) VALUES ($1, $2, $3, 'OBSERVATION', $4, $5::jsonb, $6, false, false, 'ROUTINE', 'demo-routine-activity', 'CLIENT_VISIBLE', 'SUBMITTED')",
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
      "INSERT INTO incident_reports (id, site_id, shift_assignment_id, originating_activity_entry_id, reported_by_user_id, incident_number, classification, severity, occurred_at, narrative, actions_taken, emergency_service_involvement, submission_key, status, visibility) VALUES ($1, $2, $3, $4, $5, 'INC-DEMO-0001', 'SECURITY', 'LOW', $6, 'Synthetic demo access-control concern for review.', 'Logged the concern and notified operations.', false, 'demo-incident', 'SUBMITTED', 'CLIENT_VISIBLE')",
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
      "INSERT INTO handoffs (id, shift_assignment_id, unresolved_issues, equipment_key_status, follow_up_items, submitted_at, submission_key, status, visibility, acknowledged_by_user_id, acknowledged_at) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, 'demo-handoff', 'SUBMITTED', 'INTERNAL', $7, $6)",
      [
        ids.handoff,
        ids.assignment,
        JSON.stringify(["Review synthetic access-control concern."]),
        JSON.stringify({
          summary: "North lobby keys and radio accounted for.",
        }),
        JSON.stringify(["Operations review completed."]),
        endsAt,
        ids.operationsUser,
      ],
    );
    await pool.query(
      "INSERT INTO end_of_shift_reports (id, shift_assignment_id, submitted_by_user_id, summary, unresolved_issues, equipment_access_status, follow_up_items, unusual_conditions, submission_key, submitted_at) VALUES ($1, $2, $3, 'North Lobby shift completed.', $4::jsonb, 'Keys accounted for; radio charging.', $5::jsonb, '', 'demo-eosr', $6)",
      [
        ids.eosr,
        ids.assignment,
        ids.guardUser,
        JSON.stringify(["Door closer service remains pending."]),
        JSON.stringify(["Confirm maintenance arrival."]),
        now,
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
