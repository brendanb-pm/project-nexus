import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OperationsCenter } from "@/components/operations/operations-center";

describe("Operations Center", () => {
  it("renders a scoped exception with its source action", () => {
    render(
      <OperationsCenter
        state={{
          kind: "ready",
          exceptions: {
            hasMore: false,
            items: [
              {
                id: "gap-1",
                type: "COVERAGE_GAP",
                severity: "URGENT",
                effectiveAt: "2026-09-01T00:00:00.000Z",
                organizationId: "org",
                branchId: "branch",
                clientId: "client",
                siteId: "site",
                postId: "post",
                source: {
                  entityType: "CoverageRequirement",
                  entityId: "req",
                  href: "/admin/scheduling",
                },
                title: "Coverage gap",
                detail: "One Guard is unassigned.",
              },
            ],
          },
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Operations Center" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Needs Attention" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open source record/i }),
    ).toHaveAttribute("href", "/admin/scheduling");
  });
});
