import { describe, expect, it } from "vitest";
import { authorize, hasCapability } from "@/auth/authorization";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";

const guard: AuthenticatedPrincipal = {
  userId: "user-1",
  employeeId: "employee-1",
  organizationId: "org-1",
  roles: ["GUARD"],
  branchIds: ["branch-1"],
  clientIds: ["client-1"],
  siteIds: ["site-1"],
};
const clientUser: AuthenticatedPrincipal = {
  userId: "user-2",
  organizationId: "org-1",
  roles: ["CLIENT_USER"],
  branchIds: ["branch-1"],
  clientIds: ["client-1"],
  siteIds: ["site-1"],
};
const operationsManager: AuthenticatedPrincipal = {
  userId: "user-3",
  employeeId: "employee-3",
  organizationId: "org-1",
  roles: ["OPERATIONS_MANAGER"],
  branchIds: ["branch-1"],
  clientIds: ["client-1"],
  siteIds: ["site-1"],
};

describe("centralized authorization", () => {
  it("denies a guard access to another guard's assignment", () => {
    expect(
      authorize(guard, "VIEW_OWN_ASSIGNMENTS", {
        organizationId: "org-1",
        branchId: "branch-1",
        clientId: "client-1",
        siteId: "site-1",
        employeeId: "employee-2",
      }),
    ).toEqual({ allowed: false, reason: "employee-self-scope" });
  });

  it("allows a guard to access their own assignment", () => {
    expect(
      authorize(guard, "VIEW_OWN_ASSIGNMENTS", {
        organizationId: "org-1",
        branchId: "branch-1",
        clientId: "client-1",
        siteId: "site-1",
        employeeId: "employee-1",
      }),
    ).toEqual({ allowed: true });
  });

  it("denies a client user access to another client's records", () => {
    expect(
      authorize(clientUser, "VIEW_CLIENT_REPORTS", {
        organizationId: "org-1",
        branchId: "branch-1",
        clientId: "client-2",
        siteId: "site-2",
        visibility: "CLIENT_VISIBLE",
      }),
    ).toEqual({ allowed: false, reason: "client-scope" });
  });

  it.each(["INTERNAL", "RESTRICTED"] as const)(
    "denies a client user access to %s records at an authorized site",
    (visibility) => {
      expect(
        authorize(clientUser, "VIEW_CLIENT_INCIDENTS", {
          organizationId: "org-1",
          branchId: "branch-1",
          clientId: "client-1",
          siteId: "site-1",
          visibility,
        }),
      ).toEqual({ allowed: false, reason: "visibility" });
    },
  );

  it("allows an operations manager to access in-scope operational records", () => {
    expect(
      authorize(operationsManager, "VIEW_SITE_OPERATIONS", {
        organizationId: "org-1",
        branchId: "branch-1",
        clientId: "client-1",
        siteId: "site-1",
        visibility: "INTERNAL",
      }),
    ).toEqual({ allowed: true });
  });

  it("denies cross-organization access before trusting nested scope identifiers", () => {
    expect(
      authorize(operationsManager, "VIEW_SITE_OPERATIONS", {
        organizationId: "org-2",
        branchId: "branch-1",
        clientId: "client-1",
        siteId: "site-1",
      }),
    ).toEqual({ allowed: false, reason: "organization-scope" });
  });

  it("resolves permissions through the centralized role capability map", () => {
    expect(hasCapability(guard, "CLOCK_OWN_SHIFT")).toBe(true);
    expect(hasCapability(guard, "MANAGE_ROLES")).toBe(false);
  });

  it("keeps organization administration limited to explicit admin capabilities", () => {
    expect(hasCapability(operationsManager, "MANAGE_ORGANIZATION")).toBe(false);
    expect(
      hasCapability(
        { ...operationsManager, roles: ["ADMIN"] },
        "MANAGE_BRANCHES",
      ),
    ).toBe(true);
  });
});
