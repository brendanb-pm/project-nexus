import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComplianceAdmin } from "@/components/admin/compliance-admin";
describe("NX-1.5 compliance UI states", () => {
  it("renders loading, permission, and empty states safely", () => {
    const { rerender } = render(
      <ComplianceAdmin state={{ kind: "loading" }} />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    rerender(
      <ComplianceAdmin
        state={{ kind: "permission-denied", message: "Not permitted." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Access unavailable");
    rerender(
      <ComplianceAdmin
        state={{ kind: "ready", canManage: false, employees: [] }}
      />,
    );
    expect(screen.getByText(/No employees are available/)).toBeInTheDocument();
  });
});
