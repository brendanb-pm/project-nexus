import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  emitDiagnosticEvent,
  projectDiagnosticError,
} from "../src/server/performance/diagnostics";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    console.log("Nexus migrations applied.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  emitDiagnosticEvent({
    event: "nexus.diagnostic.error",
    operation: "db-migrate",
    correlationToken: randomUUID(),
    outcome: "error",
    errorCode: projectDiagnosticError(error),
  });
  process.exitCode = 1;
});
