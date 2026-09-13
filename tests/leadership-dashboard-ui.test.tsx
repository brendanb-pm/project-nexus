import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LeadershipDashboardView } from "@/components/leadership/leadership-dashboard";
import type { LeadershipDashboardPageState } from "@/features/leadership-dashboard/contracts";

afterEach(cleanup);

const state: LeadershipDashboardPageState = {
  kind: "ready",
  dashboard: {
    scopeLabel: "Authorized portfolio",
    window: {
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-09-02T00:00:00.000Z",
      asOf: "2026-09-01T12:00:00.000Z",
    },
    filters: {
      clients: [{ id: "client-1", name: "Cedar Plaza" }],
      sites: [{ id: "site-1", clientId: "client-1", name: "North" }],
    },
    operationalHealth: {
      required: {
        seconds: 28800,
        sourceState: "AVAILABLE",
        sourceLabel: "Coverage requirement",
      },
      scheduled: {
        seconds: 14400,
        sourceState: "AVAILABLE",
        sourceLabel: "Assigned schedule",
      },
      actual: {
        seconds: null,
        sourceState: "UNAVAILABLE",
        sourceLabel: "No authoritative time",
      },
      coveragePercent: 50,
      currentGapCount: 1,
      upcomingGapCount: 2,
      scheduledStaffing: { assigned: 1, required: 2 },
      shiftClose: { due: 3, complete: 2, incomplete: 1 },
    },
    incidents: { submittedOrLater: 2 },
    compliance: {
      blockingAssignment: 1,
      expiredOrRestricted: 2,
      missingRequired: 3,
      pendingVerification: 4,
      expiringSoon: 5,
    },
    exceptions: [
      {
        siteId: "site-1",
        siteName: "North",
        postId: "post-1",
        postName: "Lobby",
        status: "CRITICAL",
        currentGapCount: 1,
        upcomingGapCount: 0,
        incompleteShiftCloseCount: 1,
        href: "/operations/sites/site-1/posts/post-1",
      },
    ],
    financial: {
      state: "UNAVAILABLE",
      message:
        "Financial performance is unavailable until canonical billing and payroll foundations are implemented.",
    },
  },
};

describe("NX-6.4 leadership dashboard UI", () => {
  it("renders aggregate operational health, scope, drilldown, and unavailable financial state", () => {
    render(<LeadershipDashboardView state={state} />);
    expect(
      screen.getByRole("heading", { name: "Leadership Operations" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Authorized portfolio")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Financial performance is unavailable until canonical billing and payroll foundations are implemented.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Inspect canonical Post scorecard/ }),
    ).toHaveAttribute("href", "/operations/sites/site-1/posts/post-1");
    expect(
      screen.getByText("Submitted-or-later incidents"),
    ).toBeInTheDocument();
  });

  it("does not render employee-level compliance detail", () => {
    render(<LeadershipDashboardView state={state} />);
    expect(screen.queryByText("Private Guard")).toBeNull();
    expect(screen.queryByText("NPS-999")).toBeNull();
    expect(screen.getByText(/Aggregate risk only/)).toBeInTheDocument();
  });

  it("renders an understandable authorization denial", () => {
    render(
      <LeadershipDashboardView
        state={{
          kind: "permission-denied",
          message: "You do not have permission to view leadership operations.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You do not have permission to view leadership operations.",
    );
  });
});
