import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { organizations } from "@/server/db/schema";
import { matchesUpdatedAt } from "@/server/db/optimistic-concurrency";

describe("optimistic concurrency", () => {
  it("compares PostgreSQL timestamps at the ISO transport precision", () => {
    const query = new PgDialect().sqlToQuery(
      matchesUpdatedAt(organizations.updatedAt, "2026-08-24T00:00:00.123Z"),
    );

    expect(query.sql).toContain("date_trunc('milliseconds'");
    expect(query.params).toEqual([new Date("2026-08-24T00:00:00.123Z")]);
  });
});
