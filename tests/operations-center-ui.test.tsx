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
          scorecards: {
            window: {
              startsAt: "2026-08-31T12:00:00.000Z",
              endsAt: "2026-09-01T12:00:00.000Z",
              asOf: "2026-09-01T00:00:00.000Z",
            },
            sites: [],
          },
          recordWorkflow: {
            reviewQueue: [],
            history: [
              {
                key: "eosr:eosr-1",
                family: "eosr",
                id: "eosr-1",
                typeLabel: "EOSR",
                siteName: "Cedar Plaza",
                postName: "Lobby",
                timestamp: "2026-09-01T01:00:00.000Z",
                actorName: "Guard A",
                status: "COMPLETED",
                summary: "Shift secured.",
                href: "/operations/records/eosr/eosr-1",
                actionable: false,
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
    expect(
      screen.getByRole("heading", { name: "History / Recent Activity" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Shift secured.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open canonical eosr record/i }),
    ).toHaveAttribute("href", "/operations/records/eosr/eosr-1");
  });
});
