import { describe, expect, it } from "vitest";
import { seedData } from "@/server/db/seed/data";
import { validateSeedData } from "@/server/db/seed/validate";

describe("deterministic seed", () => {
  it("contains connected, tenant-aware development records", () => {
    expect(validateSeedData(seedData)).toEqual([]);
    expect(seedData.organizations).toHaveLength(2);
    expect(seedData.clients).toHaveLength(2);
    expect(seedData.sites).toHaveLength(3);
  });
});
