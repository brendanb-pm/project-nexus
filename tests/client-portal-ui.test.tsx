import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClientPortal } from "@/components/client/client-portal";

describe("NX5.5 client portal UI", () => {
  it("renders the explicit client-safe report and incident projection", () => {
    render(
      <ClientPortal
        state={{
          coverage: [
            {
              id: "site-1",
              name: "Cedar Plaza",
              status: "HEALTHY",
              coveragePercent: 100,
              currentGapCount: 0,
              upcomingGapCount: 0,
              posts: [
                {
                  id: "post-1",
                  name: "North lobby",
                  status: "HEALTHY",
                  coveragePercent: 100,
                  currentGapCount: 0,
                  upcomingGapCount: 0,
                },
              ],
            },
          ],
          reports: [
            {
              id: "report-1",
              site: "Cedar Plaza",
              post: "North lobby",
              occurredAt: "2026-09-11T12:00:00.000Z",
              category: "OBSERVATION",
              narrative: "Client-safe report narrative.",
              actionTaken: "Client-safe action.",
            },
          ],
          incidents: [
            {
              id: "incident-1",
              site: "Cedar Plaza",
              post: "North lobby",
              occurredAt: "2026-09-11T12:00:00.000Z",
              number: "INC-100",
              severity: "LOW",
              narrative: "Client-safe incident narrative.",
              actionsTaken: "Client-safe response.",
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Your operational visibility" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Client-safe report narrative.")).toBeVisible();
    expect(screen.getByText("Client-safe incident narrative.")).toBeVisible();
    expect(screen.getByText("Current coverage")).toBeVisible();
    expect(screen.getByText("Coverage on track")).toBeVisible();
    expect(
      screen.queryByText(/evidence|audit|reviewer/i),
    ).not.toBeInTheDocument();
  });

  it("communicates a safe access denial without exposing records", () => {
    render(
      <ClientPortal
        state={{ error: "You do not have access to this client portal." }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Client portal unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/do not have access/i)).toBeVisible();
  });
});
