import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrganizationBranchAdmin } from "@/components/admin/organization-branch-admin";

afterEach(cleanup);

describe("organization administration states", () => {
  it("renders loading acknowledgement", () => {
    render(<OrganizationBranchAdmin state={{ kind: "loading" }} />);
    expect(
      screen.getByText(/Loading organization administration/),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("renders permission denial without exposing records", () => {
    render(
      <OrganizationBranchAdmin
        state={{ kind: "permission-denied", message: "Access denied." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Access denied.");
    expect(screen.queryByText("Branches")).not.toBeInTheDocument();
  });

  it("renders a retryable error state", () => {
    render(
      <OrganizationBranchAdmin
        state={{ kind: "error", message: "Try later.", retryable: true }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Retry by refreshing");
  });

  it("renders an empty branch state without raw ID input", () => {
    const { container } = render(
      <OrganizationBranchAdmin
        state={{
          kind: "ready",
          organization: {
            name: "Northstar",
            status: "active",
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
          branches: { items: [] },
        }}
      />,
    );
    expect(
      screen.getByText("No branches yet. Add the first branch above."),
    ).toBeInTheDocument();
    expect(container.querySelector('input[name="organizationId"]')).toBeNull();
    expect(container.querySelector('input[name="branchId"]')).toBeNull();
  });

  it("keeps persistence IDs hidden while showing human-readable branch context", () => {
    const { container } = render(
      <OrganizationBranchAdmin
        state={{
          kind: "ready",
          organization: {
            name: "Northstar",
            status: "active",
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
          branches: {
            items: [
              {
                id: "internal-branch-id",
                name: "Central",
                timezone: "America/Los_Angeles",
                status: "active",
                updatedAt: "2026-08-23T00:00:00.000Z",
              },
            ],
          },
        }}
      />,
    );
    expect(screen.getByDisplayValue("Central")).toBeInTheDocument();
    expect(screen.queryByText("internal-branch-id")).not.toBeInTheDocument();
    expect(container.querySelector('input[name="branchId"]')).toHaveAttribute(
      "type",
      "hidden",
    );
  });

  it("renders server validation feedback as an actionable state", () => {
    render(
      <OrganizationBranchAdmin
        state={{
          kind: "ready",
          organization: {
            name: "Northstar",
            status: "active",
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
          branches: { items: [] },
          notice: {
            kind: "validation",
            message: "Check the highlighted fields and try again.",
            fieldErrors: { timezone: ["Enter a valid IANA timezone."] },
          },
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid IANA timezone.",
    );
  });
});
