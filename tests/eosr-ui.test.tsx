import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EndOfShiftReportForm } from "@/components/eosr/end-of-shift-report-form";

const passdown = {
  id: "eosr-1",
  shiftAssignmentId: "outgoing-1",
  incomingAssignmentId: "incoming-1",
  siteName: "Cedar Plaza",
  postName: "North Lobby",
  summary: "Lobby secured.",
  unresolvedIssues: ["Door closer needs service"],
  equipmentAccessStatus: "Radio charged",
  followUpItems: [],
  unusualConditions: "",
  submittedByUserId: "guard-1",
  submittedAt: "2026-09-01T00:00:00.000Z",
  dismissed: false,
};

describe("EOSR Guard workflow", () => {
  afterEach(cleanup);
  it("keeps the incoming passdown visible without an active close assignment", () => {
    render(
      <EndOfShiftReportForm
        assignments={[]}
        passdowns={[passdown]}
        submit={vi.fn()}
        setPassdownDismissal={vi.fn()}
      />,
    );
    expect(screen.getByText(/Incoming passdown.*Cedar Plaza/i)).toBeVisible();
    expect(screen.getByText(/No authorized active assignment/i)).toBeVisible();
  });

  it("offers a non-destructive dismiss action and a reopen action", () => {
    const dismissal = vi.fn(async () => undefined);
    const { rerender } = render(
      <EndOfShiftReportForm
        assignments={[]}
        passdowns={[passdown]}
        submit={vi.fn()}
        setPassdownDismissal={dismissal}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss passdown" }));
    expect(dismissal).toHaveBeenCalledTimes(1);
    rerender(
      <EndOfShiftReportForm
        assignments={[]}
        passdowns={[{ ...passdown, dismissed: true }]}
        submit={vi.fn()}
        setPassdownDismissal={dismissal}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Reopen passdown" }),
    ).toBeVisible();
    expect(screen.getByText("Lobby secured.")).toBeVisible();
  });
});
