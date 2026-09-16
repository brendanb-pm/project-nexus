import { writeFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { AuthenticatedPrincipal } from "../src/shared/types/auth";
import { loadAssetPage } from "../src/features/assets/application";
import { createAssetService } from "../src/features/assets/server";
import { loadLeadershipDashboard } from "../src/features/leadership-dashboard/application";
import { createLeadershipDashboardService } from "../src/features/leadership-dashboard/server";
import { loadOperationsCenter } from "../src/features/operations/application";
import { createOperationsService } from "../src/features/operations/server";
import { loadReportingPage } from "../src/features/reporting/application";
import { createReportingService } from "../src/features/reporting/server";
import { createEndOfShiftReportService } from "../src/features/eosr/server";
import type { PrincipalResolver } from "../src/server/request/context";
import {
  instrumentPgClient,
  measureRequest,
  type RequestPerformanceSample,
} from "../src/server/performance/telemetry";
import { summarizeOperations } from "../src/server/performance/statistics";
import * as schema from "../src/server/db/schema";

const SAMPLE_COUNT = 30;
const organizationId = "00000000-0000-4000-8000-000000000001";
const adminUserId = "00000000-0000-4000-8000-000000000134";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function resolver(): PrincipalResolver {
  const principal: AuthenticatedPrincipal = {
    userId: adminUserId,
    organizationId,
    organizationWide: true,
    roles: ["ADMIN"],
    branchIds: [],
    clientIds: [],
    siteIds: [],
  };
  return {
    resolve: async () => ({
      principal,
      authentication: { provider: "synthetic-nx72-performance-fixture" },
    }),
  };
}

async function runSamples(operation: string, work: () => Promise<unknown>) {
  await measureRequest(operation, work);
  const samples: RequestPerformanceSample[] = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    await measureRequest(operation, work, (sample) => samples.push(sample));
  }
  return samples;
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
  const database = drizzle(pool, { schema });
  const databaseFactory = () => database;

  try {
    const measurements = [
      ...(await runSamples("operations.page", () =>
        loadOperationsCenter(
          createOperationsService(
            resolver(),
            "operations.page",
            databaseFactory,
          ),
          createEndOfShiftReportService(
            resolver(),
            "operations.completed-eosr",
            databaseFactory,
          ),
          createReportingService(
            resolver(),
            "operations.record-workflow",
            databaseFactory,
          ),
        ),
      )),
      ...(await runSamples("leadership.page", () =>
        loadLeadershipDashboard(
          createLeadershipDashboardService(
            resolver(),
            "leadership.page",
            databaseFactory,
          ),
          {},
        ),
      )),
      ...(await runSamples("reporting.page", () =>
        loadReportingPage(
          createReportingService(resolver(), "reporting.page", databaseFactory),
        ),
      )),
      ...(await runSamples("assets.page", () =>
        loadAssetPage(
          createAssetService(resolver(), "assets.page", databaseFactory),
          undefined,
          true,
        ),
      )),
    ];
    const report = {
      event: "nexus.nx72-performance-summary",
      environment: "isolated local PostgreSQL 16.8",
      fixture:
        "checked-in local demo plus caller-provided synthetic scale rows",
      warmupSamples: 1,
      samplesPerOperation: SAMPLE_COUNT,
      operations: summarizeOperations(measurements).map((operation) => ({
        ...operation,
        failures: measurements.filter(
          (sample) =>
            sample.operation === operation.operation &&
            sample.outcome === "error",
        ).length,
      })),
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
