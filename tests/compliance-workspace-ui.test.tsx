import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComplianceWorkspace } from "@/components/operations/compliance-workspace";

const item = {
  id: "employee-1:definition-1",
  priority: "BLOCKING_ASSIGNMENT" as const,
  employeeId: "employee-1",
  employeeName: "Guard A",
  employeeNumber: "NPS-100",
  branchId: "branch-1",
  branchName: "Central",
  definitionId: "definition-1",
  credentialName: "Guard card",
  credentialState: "verified" as const,
  expiresOn: "2026-10-01",
  jurisdiction: "CA",
  reason: "EXPIRES_DURING_SHIFT" as const,
  severity: "required" as const,
  actionStatus: "Guard card expires during the shift.",
  href: "/operations/compliance?employee=employee-1",
  assignment: {
    id: "assignment-1",
    siteId: "site-1",
    siteName: "Cedar",
    postId: "post-1",
    postName: "Lobby",
    startsAt: "2026-10-01T22:00:00.000Z",
    endsAt: "2026-10-02T06:00:00.000Z",
    href: "/admin/scheduling?assignmentId=assignment-1",
  },
};
describe("NX5.3 compliance workspace UI", () => {
  it("renders priority, safe drilldowns, and a usable filter", () => {
    render(
      <ComplianceWorkspace
        state={{
          kind: "ready",
          workspace: {
            items: [item],
            summary: {
              BLOCKING_ASSIGNMENT: 1,
              EXPIRED_OR_RESTRICTED: 0,
              MISSING_REQUIRED: 0,
              PENDING_VERIFICATION: 0,
              EXPIRING_SOON: 0,
              INFORMATIONAL: 0,
            },
          },
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Compliance workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Guard card expires during the shift."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View affected assignment" }),
    ).toHaveAttribute("href", "/admin/scheduling?assignmentId=assignment-1");
    fireEvent.change(screen.getByPlaceholderText("Search compliance queue"), {
      target: { value: "absent" },
    });
    expect(
      screen.getByText("No matching compliance exceptions"),
    ).toBeInTheDocument();
  });
});
