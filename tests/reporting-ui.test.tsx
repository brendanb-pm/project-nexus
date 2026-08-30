import { render, screen } from "@testing-library/react";
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
};

describe("NX-3.1 reporting UI", () => {
  it("uses human-readable authoritative assignment context", () => {
    render(
      <ReportingWorkspace
        actions={{ createActivity: vi.fn(), createIncident: vi.fn() }}
        state={ready}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Shift activity" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("option", { name: /Cedar Plaza.*Lobby/ }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Record activity" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit incident report" }),
    ).toBeInTheDocument();
  });

  it("renders an actionable empty state and stable denial state", () => {
    const { rerender } = render(
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
