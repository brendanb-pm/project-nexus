import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportingWorkspace } from "@/components/reporting/reporting-workspace";
import type { ReportingPageState } from "@/features/reporting/contracts";

const ready: ReportingPageState = {
  kind: "ready",
  assignments: [
    {
      id: "assignment-1",
      siteName: "Cedar Plaza",
      postName: "Lobby",
      scheduledStart: "2026-08-29T08:00:00.000Z",
      scheduledEnd: "2026-08-29T16:00:00.000Z",
    },
  ],
  recent: [],
  incidents: [],
  handoffs: [],
};

describe("NX-3.1 reporting UI", () => {
  it("uses human-readable authoritative assignment context", () => {
    render(
      <ReportingWorkspace
        actions={{
          createActivity: vi.fn(),
          createIncident: vi.fn(),
          createHandoff: vi.fn(),
        }}
        state={ready}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Shift activity" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("option", { name: /Cedar Plaza.*Lobby/ }),
    ).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Record activity" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit incident report" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit handoff" }),
    ).toBeInTheDocument();
  });

  it("renders an actionable empty state and stable denial state", () => {
    const { container, rerender } = render(
      <ReportingWorkspace state={{ ...ready, assignments: [] }} />,
    );
    expect(screen.getByText(/No active assignment/i)).toBeInTheDocument();
    rerender(
      <ReportingWorkspace
        state={{ kind: "permission-denied", message: "Not authorized." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Not authorized");
  });
});

describe("NX-3.5 supervisor review UI", () => {
  const reviewState: ReportingPageState = {
    ...ready,
    reviewEnabled: true,
    recent: [
      {
        id: "activity-1",
        shiftAssignmentId: "assignment-1",
        siteName: "Cedar Plaza",
        postName: "Lobby",
        occurredAt: "2026-08-29T12:00:00.000Z",
        category: "OBSERVATION",
        narrative: "Original guard entry",
        followUpRequired: false,
        visibility: "INTERNAL",
        status: "SUBMITTED",
        createdAt: "2026-08-29T12:00:00.000Z",
        incidentGate: "ROUTINE",
      },
    ],
  };
  it("shows acknowledge/amend/history controls and prevents double submit", async () => {
    const acknowledge = vi.fn(async () => ({
      entityType: "ActivityEntry" as const,
      id: "activity-1",
      organizationId: "org-1",
      branchId: "branch-1",
      clientId: "client-1",
      siteId: "site-1",
      visibility: "INTERNAL" as const,
      revision: 0,
      snapshot: {},
      history: [],
    }));
    const getRecord = vi.fn(async () => ({
      entityType: "ActivityEntry" as const,
      id: "activity-1",
      organizationId: "org-1",
      branchId: "branch-1",
      clientId: "client-1",
      siteId: "site-1",
      visibility: "INTERNAL" as const,
      revision: 1,
      snapshot: { authoredByUserId: "guard-1" },
      history: [
        {
          revision: 1,
          changedByUserId: "supervisor-1",
          changedAt: "2026-08-30T12:00:00.000Z",
          reason: "Clarifies sequence",
          snapshot: { narrative: "Corrected" },
        },
      ],
    }));
    render(
      <ReportingWorkspace
        state={reviewState}
        actions={{
          createActivity: vi.fn(),
          createIncident: vi.fn(),
          createHandoff: vi.fn(),
          acknowledgeOperationalRecord: acknowledge,
          getOperationalRecord: getRecord,
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /supervisor \/ operations review/i }),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Acknowledge" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(acknowledge).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText("Acknowledged")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "View history" }));
    await waitFor(() =>
      expect(screen.getByText(/Clarifies sequence/)).toBeInTheDocument(),
    );
  });
  it("requires an amendment reason and does not expose controls when review is disabled", async () => {
    const amend = vi.fn();
    render(
      <ReportingWorkspace
        state={reviewState}
        actions={{
          createActivity: vi.fn(),
          createIncident: vi.fn(),
          createHandoff: vi.fn(),
          amendOperationalRecord: amend,
        }}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Record amendment" })[0],
    );
    expect(screen.getAllByText(/Amendment reason/i).length).toBeGreaterThan(0);
    expect(amend).not.toHaveBeenCalled();
    const { container } = render(
      <ReportingWorkspace state={{ ...reviewState, reviewEnabled: false }} />,
    );
    expect(
      container.querySelector(
        '[aria-label="Supervisor and operations review"]',
      ),
    ).not.toBeInTheDocument();
  });
});
