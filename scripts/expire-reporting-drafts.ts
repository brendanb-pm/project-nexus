import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import { PostgresReportingDraftRepository } from "../src/features/reporting-drafts/postgres-repository";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (process.env.NEXUS_REPORTING_DRAFT_EXPIRY_JOB !== "true")
    throw new Error("Explicit reporting draft expiry job marker is required.");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const pool = new Pool({ connectionString, max: 2 });
  try {
    const repository = new PostgresReportingDraftRepository(
      drizzle(pool, { schema }),
    );
    let expired = 0;
    for (let batch = 0; batch < 10; batch++) {
      const count = await repository.expireBatch(100);
      expired += count;
      if (count < 100) break;
    }
    console.log(`Reporting draft expiry: ${expired} payloads retired.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
