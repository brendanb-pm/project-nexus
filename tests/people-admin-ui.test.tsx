import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PeopleAdmin } from "@/components/admin/people-admin";
describe("NX-1.4 employee UI states", () => {
  it("renders loading, permission, and empty states safely", () => {
    const { rerender } = render(<PeopleAdmin state={{ kind: "loading" }} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    rerender(
      <PeopleAdmin
        state={{ kind: "permission-denied", message: "Not permitted." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Access unavailable");
    rerender(
      <PeopleAdmin
        state={{
          kind: "ready",
          canManage: false,
          branches: [],
          users: [],
          employees: { items: [], hasMore: false },
        }}
      />,
    );
    expect(screen.getByText(/No employees are available/)).toBeInTheDocument();
    expect(screen.getByText(/Read-only compliance access/)).toBeInTheDocument();
  });
});
