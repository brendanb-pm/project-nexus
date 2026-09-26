import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EndOfShiftReportForm } from "@/components/eosr/end-of-shift-report-form";

const passdown = {
  id: "eosr-1",
  shiftAssignmentId: "outgoing-1",
  incomingAssignmentId: "incoming-1",
  incomingScheduledStart: "2026-09-01T08:00:00.000Z",
  incomingScheduledEnd: "2026-09-01T16:00:00.000Z",
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
    expect(screen.queryByText("Lobby secured.")).not.toBeInTheDocument();
    expect(screen.getByText(/Passdown dismissed/i)).toBeVisible();
  });

  it("requires a review and submits only the selected structured passdown", async () => {
    const submit = vi.fn(async (form: FormData) => {
      expect(form).toBeInstanceOf(FormData);
      return { kind: "confirmed" };
    });
    const { container } = render(
      <EndOfShiftReportForm
        assignments={[
          {
            id: "outgoing-1",
            siteName: "Cedar Plaza",
            postName: "North Lobby",
            scheduledStart: "2026-09-01T00:00:00.000Z",
            scheduledEnd: "2026-09-01T08:00:00.000Z",
          },
        ]}
        embedded
        submit={submit}
        setPassdownDismissal={vi.fn()}
      />,
    );
    const review = screen.getByRole("button", {
      name: "Review before submitting",
    });
    fireEvent.click(review);
    expect(
      screen.queryByRole("region", { name: "Closeout review" }),
    ).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Shift summary"), {
      target: { value: "Lobby secured." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Issues remain" }));
    fireEvent.change(screen.getByLabelText("Unresolved issues"), {
      target: { value: "Door service pending." },
    });
    fireEvent.submit(container.querySelector("form")!);
    expect(submit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("region", { name: "Closeout review" }),
    ).toHaveTextContent("Door service pending.");
    expect(submit).not.toHaveBeenCalled();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const submitted = submit.mock.calls[0]![0] as FormData;
    expect(submitted.get("summary")).toBe("Lobby secured.");
    expect(submitted.get("unresolvedIssues")).toBe("Door service pending.");
    expect(submitted.get("equipmentAccessStatus")).toBeNull();
    expect(
      await screen.findByText(/End-of-shift report submitted/),
    ).toBeVisible();
  });
});
