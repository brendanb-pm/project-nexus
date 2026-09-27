import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClientPortal } from "@/components/client/client-portal";

describe("NX-8.12 client publication boundary", () => {
  it("renders only published client-safe versions, never raw source fields", () => {
    render(
      <ClientPortal
        state={{
          publications: [
            {
              id: "publication-1",
              clientId: "client-1",
              siteIds: ["site-1"],
              version: 2,
              isCurrent: true,
              publishedAt: "2026-09-26T12:00:00.000Z",
              supersedesId: "publication-0",
              snapshot: {
                clientId: "client-1",
                clientName: "Cedar Plaza",
                sites: [{ id: "site-1", name: "North" }],
                periodStart: "2026-09-25T00:00:00.000Z",
                periodEnd: "2026-09-26T00:00:00.000Z",
                executiveSummary: "Reviewed client-safe summary.",
                completionSummary: "Reviewed closeout.",
                followUps: [],
                sources: [],
              },
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Published site reports" }),
    ).toBeVisible();
    expect(screen.getByText("Reviewed client-safe summary.")).toBeVisible();
    expect(screen.getByText("Current published version")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open published version" }),
    ).toHaveAttribute("href", "/portal/reports/publication-1");
    expect(
      screen.queryByText(/narrative|participant|audit|draft/i),
    ).not.toBeInTheDocument();
  });

  it("labels a superseded version as historical", () => {
    render(
      <ClientPortal
        state={{
          publications: [
            {
              id: "publication-0",
              clientId: "client-1",
              siteIds: ["site-1"],
              version: 1,
              isCurrent: false,
              publishedAt: "2026-09-25T12:00:00.000Z",
              snapshot: {
                clientId: "client-1",
                clientName: "Cedar Plaza",
                sites: [{ id: "site-1", name: "North" }],
                periodStart: "2026-09-24T00:00:00.000Z",
                periodEnd: "2026-09-25T00:00:00.000Z",
                executiveSummary: "Earlier reviewed summary.",
                completionSummary: "Earlier closeout.",
                followUps: [],
                sources: [],
              },
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Superseded historical version")).toBeVisible();
  });

  it("has an honest empty state and a safe denial", () => {
    const { rerender } = render(<ClientPortal state={{ publications: [] }} />);
    expect(screen.getByText(/No published client reports/)).toBeVisible();
    rerender(
      <ClientPortal
        state={{ error: "You do not have access to this client portal." }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Client portal unavailable" }),
    ).toBeVisible();
  });
});
