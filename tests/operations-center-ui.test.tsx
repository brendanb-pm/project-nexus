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
          completedReports: [
            {
              id: "eosr-1",
              shiftAssignmentId: "assignment-1",
              siteName: "Cedar Plaza",
              postName: "Lobby",
              summary: "Shift secured.",
              unresolvedIssues: ["Door closer service pending"],
              equipmentAccessStatus: "Keys accounted for",
              followUpItems: ["Confirm maintenance"],
              unusualConditions: "",
              submittedByUserId: "guard-1",
              submittedAt: "2026-09-01T01:00:00.000Z",
            },
          ],
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
      screen.getByRole("heading", { name: "Completed EOSR review history" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Shift secured.")).toBeInTheDocument();
    expect(screen.getByText(/Door closer service pending/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /historical handoffs/i }),
    ).toHaveAttribute("href", "/reporting");
  });
});
