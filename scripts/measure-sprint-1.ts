import { writeFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AuthorizedDataAccess } from "../src/server/request/boundary";
import {
  createAuthenticatedRequestContext,
  type AuthenticatedRequestContext,
} from "../src/server/request/context";
import {
  instrumentPgClient,
  measureRequest,
  type RequestPerformanceSample,
} from "../src/server/performance/telemetry";
import { summarizeOperations } from "../src/server/performance/statistics";
import * as schema from "../src/server/db/schema";
import { OrganizationAdminService } from "../src/features/organization-admin/service";
import { PostgresOrganizationAdminRepository } from "../src/features/organization-admin/postgres-repository";
import { loadOrganizationAdminPage } from "../src/features/organization-admin/application";
import { ClientAdminService } from "../src/features/client-admin/service";
import { PostgresClientAdminRepository } from "../src/features/client-admin/postgres-repository";
import { loadClientAdminPage } from "../src/features/client-admin/application";
import { SiteAdminService } from "../src/features/site-admin/service";
import { PostgresSiteAdminRepository } from "../src/features/site-admin/postgres-repository";
import { loadSiteAdminPage } from "../src/features/site-admin/application";
import { PeopleAdminService } from "../src/features/people-admin/service";
import { PostgresPeopleAdminRepository } from "../src/features/people-admin/postgres-repository";
import { loadPeopleAdminPage } from "../src/features/people-admin/application";
import { ComplianceAdminService } from "../src/features/compliance-admin/service";
import { PostgresComplianceAdminRepository } from "../src/features/compliance-admin/postgres-repository";
import { loadComplianceAdminPage } from "../src/features/compliance-admin/application";
import type { AuthenticatedPrincipal } from "../src/shared/types/auth";

const SAMPLE_COUNT = 30;
const FIXTURE_COUNT = 35;
const organizationId = "00000000-0000-4000-8000-000000000001";
const adminUserId = "00000000-0000-4000-8000-000000000002";
const id = (value: number) =>
  `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;

const principal: AuthenticatedPrincipal = {
  userId: adminUserId,
  organizationId,
  organizationWide: true,
  roles: ["ADMIN"],
  branchIds: [],
  clientIds: [],
  siteIds: [],
};

type Database = NodePgDatabase<typeof schema>;
type OperationResult = {
  operation: string;
  samples: RequestPerformanceSample[];
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function insertRows(
  pool: Pool,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
): Promise<void> {
  if (!rows.length) return;
  const values = rows.flat();
  const placeholders = rows
    .map(
      (row, rowIndex) =>
        `(${row
          .map(
            (_, columnIndex) =>
              `$${rowIndex * columns.length + columnIndex + 1}`,
          )
          .join(", ")})`,
    )
    .join(", ");
  await pool.query(
    `insert into ${table} (${columns.join(", ")}) values ${placeholders}`,
    values,
  );
}

async function seedFixture(pool: Pool): Promise<void> {
  await pool.query(`
    truncate table audit_events, certifications, credentials, employee_roles,
    employees, users, posts, sites, contracts, client_contacts, clients,
    branches, organizations restart identity cascade
  `);

  await insertRows(
    pool,
    "organizations",
    ["id", "name", "status"],
    [[organizationId, "Nexus Performance Services", "active"]],
  );

  const branches = Array.from({ length: FIXTURE_COUNT }, (_, index) => [
    id(100 + index),
    organizationId,
    `Performance Branch ${String(index + 1).padStart(2, "0")}`,
    "America/Los_Angeles",
    "active",
  ]);
  await insertRows(
    pool,
    "branches",
    ["id", "organization_id", "name", "timezone", "status"],
    branches,
  );

  const clients = Array.from({ length: FIXTURE_COUNT }, (_, index) => [
    id(200 + index),
    organizationId,
    branches[index]![0],
    `Performance Client ${String(index + 1).padStart(2, "0")}`,
    "active",
  ]);
  await insertRows(
    pool,
    "clients",
    ["id", "organization_id", "branch_id", "name", "status"],
    clients,
  );
  await insertRows(
    pool,
    "client_contacts",
    ["id", "client_id", "name", "email", "phone", "status"],
    clients.map((client, index) => [
      id(300 + index),
      client[0],
      `Synthetic Contact ${index + 1}`,
      `contact-${index + 1}@example.invalid`,
      "555-0100",
      "active",
    ]),
  );
  await insertRows(
    pool,
    "contracts",
    ["id", "client_id", "name", "starts_on", "ends_on", "status"],
    clients.map((client, index) => [
      id(400 + index),
      client[0],
      `Synthetic Contract ${index + 1}`,
      "2026-01-01",
      "2026-12-31",
      "active",
    ]),
  );

  const sites = clients.map((client, index) => [
    id(500 + index),
    client[0],
    `Performance Site ${String(index + 1).padStart(2, "0")}`,
    JSON.stringify({ city: "Testville", region: "CA", country: "US" }),
    "America/Los_Angeles",
    true,
  ]);
  await insertRows(
    pool,
    "sites",
    ["id", "client_id", "name", "address", "timezone", "active"],
    sites,
  );
  await insertRows(
    pool,
    "posts",
    [
      "id",
      "site_id",
      "name",
      "description",
      "service_type",
      "armed_requirement",
      "qualification_requirements",
      "active",
    ],
    sites.map((site, index) => [
      id(600 + index),
      site[0],
      `Post ${String(index + 1).padStart(2, "0")}`,
      "Synthetic staffed position",
      "site_security",
      "unarmed",
      JSON.stringify([]),
      true,
    ]),
  );

  const users = Array.from({ length: FIXTURE_COUNT }, (_, index) => [
    id(700 + index),
    organizationId,
    `employee-${index + 1}@example.invalid`,
    "active",
  ]);
  await insertRows(
    pool,
    "users",
    ["id", "organization_id", "email", "status"],
    [
      [
        adminUserId,
        organizationId,
        "performance-admin@example.invalid",
        "active",
      ],
      ...users,
    ],
  );
  const employees = users.map((user, index) => [
    id(800 + index),
    organizationId,
    user[0],
    `PERF-${String(index + 1).padStart(3, "0")}`,
    "active",
    branches[index]![0],
    JSON.stringify({ displayName: `Synthetic Employee ${index + 1}` }),
  ]);
  await insertRows(
    pool,
    "employees",
    [
      "id",
      "organization_id",
      "user_id",
      "employee_number",
      "employment_status",
      "primary_branch_id",
      "profile",
    ],
    employees,
  );
  await insertRows(
    pool,
    "credentials",
    [
      "id",
      "employee_id",
      "type",
      "issuing_authority",
      "issued_on",
      "expires_on",
      "status",
    ],
    employees.map((employee, index) => [
      id(900 + index),
      employee[0],
      "guard_card",
      "Synthetic Authority",
      "2026-01-01",
      "2027-01-01",
      "active",
    ]),
  );
  await insertRows(
    pool,
    "certifications",
    [
      "id",
      "employee_id",
      "type",
      "issuing_authority",
      "issued_on",
      "expires_on",
      "status",
    ],
    employees.map((employee, index) => [
      id(1000 + index),
      employee[0],
      "first_aid",
      "Synthetic Authority",
      "2026-01-01",
      "2027-01-01",
      "active",
    ]),
  );
}

async function requestContext(
  operation: string,
): Promise<AuthenticatedRequestContext> {
  return createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal,
        authentication: {
          provider: "synthetic-performance-fixture",
          authenticatedAt: "2026-08-24T00:00:00.000Z",
        },
      }),
    },
    operation,
  );
}

async function runSamples(
  operation: string,
  work: () => Promise<unknown>,
): Promise<OperationResult> {
  await measureRequest(operation, work);
  const samples: RequestPerformanceSample[] = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    await measureRequest(operation, work, (sample) => samples.push(sample));
  }
  return { operation, samples };
}

async function main(): Promise<void> {
  if (process.env.NEXUS_PERFORMANCE_TELEMETRY !== "true") {
    throw new Error(
      "Set NEXUS_PERFORMANCE_TELEMETRY=true before running measurements.",
    );
  }

  const pool = new Pool({
    connectionString: requiredEnvironment("DATABASE_URL"),
    max: 1,
  });
  instrumentPgClient(pool, { delegatesQueries: true });
  pool.on("connect", instrumentPgClient);
  const database: Database = drizzle(pool, { schema });

  try {
    await seedFixture(pool);

    const organization = async (operation: string) =>
      new OrganizationAdminService(
        new AuthorizedDataAccess(await requestContext(operation)),
        new PostgresOrganizationAdminRepository(database),
      );
    const client = async (operation: string) =>
      new ClientAdminService(
        new AuthorizedDataAccess(await requestContext(operation)),
        new PostgresClientAdminRepository(database),
      );
    const site = async (operation: string) =>
      new SiteAdminService(
        new AuthorizedDataAccess(await requestContext(operation)),
        new PostgresSiteAdminRepository(database),
      );
    const people = async (operation: string) =>
      new PeopleAdminService(
        new AuthorizedDataAccess(await requestContext(operation)),
        new PostgresPeopleAdminRepository(database),
      );
    const compliance = async (operation: string) =>
      new ComplianceAdminService(
        new AuthorizedDataAccess(await requestContext(operation)),
        new PostgresComplianceAdminRepository(database),
      );

    let latestOrganizationVersion = (
      await (
        await organization("organization-admin.update-organization")
      ).getOrganization()
    ).updatedAt;
    const measurements = [
      await runSamples("organization-admin.read", async () =>
        loadOrganizationAdminPage(
          await organization("organization-admin.read"),
        ),
      ),
      await runSamples("client-admin.page", async () =>
        loadClientAdminPage(await client("client-admin.page")),
      ),
      await runSamples("site-admin.page", async () =>
        loadSiteAdminPage(await site("site-admin.page")),
      ),
      await runSamples("people-admin.page", async () =>
        loadPeopleAdminPage(await people("people-admin.page")),
      ),
      await runSamples("compliance.page", async () =>
        loadComplianceAdminPage(await compliance("compliance.page")),
      ),
      await runSamples("organization-admin.update-organization", async () => {
        const updated = await (
          await organization("organization-admin.update-organization")
        ).updateOrganization({
          name: "Nexus Performance Services",
          status: "active",
          expectedUpdatedAt: latestOrganizationVersion,
        });
        latestOrganizationVersion = updated.updatedAt;
        return updated;
      }),
    ];

    const samples = measurements.flatMap((measurement) => measurement.samples);
    const summary = summarizeOperations(samples).map((operation) => {
      const operationSamples = samples.filter(
        (sample) => sample.operation === operation.operation,
      );
      return {
        ...operation,
        minQueryCount: Math.min(
          ...operationSamples.map((sample) => sample.queryCount),
        ),
        failures: operationSamples.filter(
          (sample) => sample.outcome === "error",
        ).length,
      };
    });
    const report = {
      event: "nexus.performance-summary",
      environment: "isolated local PostgreSQL 16.15",
      fixture: {
        organizations: 1,
        branches: FIXTURE_COUNT,
        clients: FIXTURE_COUNT,
        sites: FIXTURE_COUNT,
        posts: FIXTURE_COUNT,
        employees: FIXTURE_COUNT,
        credentials: FIXTURE_COUNT,
        certifications: FIXTURE_COUNT,
      },
      warmupSamples: 1,
      samplesPerOperation: SAMPLE_COUNT,
      operations: summary,
    };
    const outputPath = requiredEnvironment("PERFORMANCE_OUTPUT");
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Performance run failed.",
  );
  process.exitCode = 1;
});
