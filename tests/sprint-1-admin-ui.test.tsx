import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClientAdmin } from "@/components/admin/client-admin";
import { SitePostAdmin } from "@/components/admin/site-post-admin";

describe("Sprint 1 administrative UI states", () => {
  afterEach(cleanup);
  it("acknowledges loading immediately", () => {
    render(
      <>
        <ClientAdmin state={{ kind: "loading" }} />
        <SitePostAdmin state={{ kind: "loading" }} />
      </>,
    );
    expect(screen.getAllByRole("status")[0]).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getAllByRole("status")[1]).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
  it("renders permission-safe errors", () => {
    render(
      <>
        <ClientAdmin
          state={{ kind: "permission-denied", message: "Not permitted." }}
        />
        <SitePostAdmin
          state={{ kind: "permission-denied", message: "Not permitted." }}
        />
      </>,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getAllByText("Access unavailable")).toHaveLength(2);
  });
  it("explains empty authorized collections", () => {
    render(
      <>
        <ClientAdmin
          state={{
            kind: "ready",
            canMutate: true,
            branches: [],
            clients: { items: [], hasMore: false },
          }}
        />
        <SitePostAdmin
          state={{
            kind: "ready",
            canManageSites: true,
            canManagePosts: true,
            clients: [],
            sites: { items: [], hasMore: false },
          }}
        />
      </>,
    );
    expect(screen.getByText(/No clients are available/)).toBeInTheDocument();
    expect(screen.getByText(/No sites are available/)).toBeInTheDocument();
  });
  it("communicates CLIENT_USER-style read-only access", () => {
    render(
      <ClientAdmin
        state={{
          kind: "ready",
          canMutate: false,
          branches: [],
          clients: { items: [], hasMore: false },
        }}
      />,
    );
    expect(screen.getByText(/Read-only access/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Add client" }),
    ).not.toBeInTheDocument();
  });
});
