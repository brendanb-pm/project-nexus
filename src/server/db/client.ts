import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { instrumentPgClient } from "@/server/performance/telemetry";
import * as schema from "./schema";

export type NexusDatabase = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let database: NexusDatabase | undefined;

export function getDatabase(): NexusDatabase {
  if (database) return database;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for server data access.");
  }

  pool = new Pool({ connectionString });
  pool.on("connect", instrumentPgClient);
  database = drizzle(pool, { schema });
  return database;
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = undefined;
  database = undefined;
}
