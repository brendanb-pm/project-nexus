import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportingExceptionQueue } from "@/components/operations/reporting-exception-queue";

const item = {
  id: "exception-1",
  organizationId: "org-1",
  assignmentId: "assignment-1",
  employeeId: "employee-1",
  branchId: "branch-1",
  clientId: "client-1",
  siteId: "site-1",
  postId: "post-1",
  obligationType: "EOSR" as const,
  classification: "LATE" as const,
  state: "OPEN" as const,
  dueAt: "2026-09-22T20:15:00.000Z",
  effectiveShiftEndAt: "2026-09-22T20:00:00.000Z",
  firstDetectedAt: "2026-09-22T20:16:00.000Z",
  revision: 0,
  sourceHref: "/reporting#shift-closeout",
};

afterEach(cleanup);

describe("NX-8.5 reporting exception queue", () => {
  it("renders a bounded empty state and a reason-required Operations action", async () => {
    const transition = vi.fn(async () => ({
      kind: "confirmed" as const,
      message: "Reporting exception updated.",
    }));
    const { rerender } = render(
      <ReportingExceptionQueue
        lifecycleRole="FULL"
        exceptions={[]}
        transition={transition}
      />,
    );
    expect(screen.getByText(/No reporting exceptions/i)).toBeInTheDocument();
    rerender(
      <ReportingExceptionQueue
        lifecycleRole="FULL"
        exceptions={[item]}
        transition={transition}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Open canonical report/i }),
    ).toHaveAttribute("href", item.sourceHref);
    const form = screen
      .getByRole("button", { name: "Update" })
      .closest("form")!;
    fireEvent.submit(form);
    expect(transition).not.toHaveBeenCalled();
    expect(
      screen.getByRole("textbox", { name: "Reason for action" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("textbox", { name: "Reason for action" }),
    ).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("combobox", { name: "Action" }),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Reason for action" }),
      { target: { value: "Reviewed by Operations" } },
    );
    fireEvent.submit(form);
    await waitFor(() => expect(transition).toHaveBeenCalledOnce());
    expect(await screen.findByRole("status")).toHaveTextContent("updated");
  });

  it("does not render waive or escalate controls for a Supervisor", () => {
    render(
      <ReportingExceptionQueue
        lifecycleRole="SUPERVISOR"
        exceptions={[item]}
        transition={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("option", { name: "Waive" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Escalate" }),
    ).not.toBeInTheDocument();
  });

  it("shows a controlled failure without reporting false success", async () => {
    render(
      <ReportingExceptionQueue
        lifecycleRole="FULL"
        exceptions={[item]}
        transition={vi.fn(async () => ({
          kind: "rejected" as const,
          message:
            "The reporting exception was not changed. Refresh and try again.",
        }))}
      />,
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Reason for action" }),
      { target: { value: "Attempted update" } },
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "Update" }).closest("form")!,
    );
    expect(await screen.findByRole("status")).toHaveTextContent("not changed");
    expect(
      screen.queryByText("Reporting exception updated."),
    ).not.toBeInTheDocument();
  });
});
