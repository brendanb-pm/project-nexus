import { describe, expect, it } from "vitest";
import { belongsToTenant, hasRole } from "@/auth/authorization";

const principal = {
  userId: "user-1",
  tenantId: "tenant-1",
  roles: ["officer"] as const,
};

describe("authorization foundation", () => {
  it("checks roles", () => expect(hasRole(principal, "officer")).toBe(true));
  it("enforces tenant boundaries", () =>
    expect(belongsToTenant(principal, "tenant-2")).toBe(false));
});
