import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationalRecordDetail } from "@/components/operations/operational-record-detail";
import { ReportingWorkspace } from "@/components/reporting/reporting-workspace";
import type { OperationalRecordDetailState } from "@/features/operations/record-detail";
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

afterEach(cleanup);

describe("NX-8.2 unified Shift Report activity workspace", () => {
  it("uses human-readable authoritative assignment context", () => {
    render(
      <ReportingWorkspace
        actions={{
          createActivity: vi.fn(),
          createIncident: vi.fn(),
        }}
        state={ready}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Your active Shift Report" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Cedar Plaza/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lobby/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Add activity/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "File Security Incident" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Closeout Shift Report" }),
    ).toHaveAttribute("href", "#shift-closeout");
    expect(screen.queryByText(/Activity \/ DAR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/EOSR/)).not.toBeInTheDocument();
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

  it("adds a server-confirmed activity to the timeline", async () => {
    const createActivity = vi.fn(async (form: FormData) => ({
      kind: "confirmed" as const,
      entry: {
        id: "activity-1",
        shiftAssignmentId: String(form.get("shiftAssignmentId")),
        siteName: "Cedar Plaza",
        postName: "Lobby",
        occurredAt: "2026-08-29T12:00:00.000Z",
        category: "OBSERVATION" as const,
        narrative: String(form.get("narrative")),
        followUpRequired: false,
        visibility: "INTERNAL" as const,
        status: "SUBMITTED" as const,
        createdAt: "2026-08-29T12:00:00.000Z",
        incidentGate: "ROUTINE" as const,
      },
    }));
    render(
      <ReportingWorkspace
        actions={{ createActivity, createIncident: vi.fn() }}
        state={ready}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Add activity/ }));
    fireEvent.change(screen.getAllByLabelText("What happened")[0]!, {
      target: { value: "Completed the north entrance patrol." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    await waitFor(() => expect(createActivity).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Completed the north entrance patrol."),
    ).toBeVisible();
    expect(
      screen.getByText(/Activity confirmed and added/i),
    ).toBeInTheDocument();
  });

  it("preserves activity input and focuses a server validation summary", async () => {
    const createActivity = vi.fn(async () => ({
      kind: "validation-error" as const,
      fieldErrors: { narrative: ["Describe what happened."] },
    }));
    render(
      <ReportingWorkspace
        actions={{ createActivity, createIncident: vi.fn() }}
        state={ready}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Add activity/ }));
    const narrative = screen.getAllByLabelText("What happened")[0]!;
    fireEvent.change(narrative, { target: { value: "Preserve this entry" } });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(narrative).toHaveValue("Preserve this entry");
    expect(screen.getByText("Describe what happened.")).toBeVisible();
  });

  it("retries an uncertain result with the same idempotency key", async () => {
    const createActivity = vi
      .fn()
      .mockRejectedValueOnce(new Error("lost"))
      .mockResolvedValueOnce({
        kind: "rejected" as const,
        message: "The assignment is no longer active.",
      });
    render(
      <ReportingWorkspace
        actions={{ createActivity, createIncident: vi.fn() }}
        state={ready}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Add activity/ }));
    fireEvent.change(screen.getAllByLabelText("What happened")[0]!, {
      target: { value: "Connection interrupted" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save activity" }));
    expect(await screen.findByText("Confirmation not received")).toBeVisible();
    const firstKey = (createActivity.mock.calls[0]![0] as FormData).get(
      "submissionKey",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Retry same submission" }),
    );
    await waitFor(() => expect(createActivity).toHaveBeenCalledTimes(2));
    expect(
      (createActivity.mock.calls[1]![0] as FormData).get("submissionKey"),
    ).toBe(firstKey);
  });

  it("keeps a linked formal incident distinct from its ActivityEntry", () => {
    render(
      <ReportingWorkspace
        state={{
          ...ready,
          recent: [
            {
              id: "activity-1",
              shiftAssignmentId: "assignment-1",
              siteName: "Cedar Plaza",
              postName: "Lobby",
              occurredAt: "2026-08-29T12:00:00.000Z",
              category: "REPORTABLE_INCIDENT",
              narrative: "Denied entry for an expired credential.",
              followUpRequired: true,
              visibility: "INTERNAL",
              status: "SUBMITTED",
              createdAt: "2026-08-29T12:00:00.000Z",
              incidentGate: "REQUIRED",
            },
          ],
          incidents: [
            {
              id: "incident-1",
              shiftAssignmentId: "assignment-1",
              originatingActivityEntryId: "activity-1",
              incidentNumber: "INC-2048",
              classification: "ACCESS",
              severity: "MEDIUM",
              occurredAt: "2026-08-29T12:00:00.000Z",
              narrative: "Formal access incident record.",
              actionsTaken: "Entry denied.",
              emergencyServiceInvolvement: false,
              status: "SUBMITTED",
              visibility: "INTERNAL",
              createdAt: "2026-08-29T12:00:00.000Z",
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByText("Denied entry for an expired credential."),
    ).toBeVisible();
    expect(
      screen.getAllByText(/Security Incident Report/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View INC-2048" })).toHaveAttribute(
      "href",
      "#incident-incident-1",
    );
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
  it("routes supervisor review work to the canonical Operations surface", () => {
    render(<ReportingWorkspace state={reviewState} />);
    expect(
      screen.getByRole("heading", { name: /supervisor \/ operations review/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Operations Center" }),
    ).toHaveAttribute("href", "/operations");
    expect(
      screen.queryByRole("button", { name: "Acknowledge" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Record amendment" }),
    ).not.toBeInTheDocument();
  });

  it("does not expose supervisor review controls when review is disabled", () => {
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

describe("NX4.5 canonical operational record detail", () => {
  const detailState: OperationalRecordDetailState = {
    kind: "ready",
    record: {
      key: "activity:activity-1",
      family: "activity",
      id: "activity-1",
      typeLabel: "Activity / DAR",
      siteName: "Cedar Plaza",
      postName: "Lobby",
      timestamp: "2026-08-29T12:00:00.000Z",
      actorName: "Guard A",
      status: "AWAITING ACKNOWLEDGEMENT",
      summary: "Original guard entry",
      href: "/operations/records/activity/activity-1",
      actionable: true,
      reviewReason: "Supervisor acknowledgement is pending.",
    },
    fields: [{ label: "Narrative", value: "Original guard entry" }],
    review: {
      entityType: "ActivityEntry",
      id: "activity-1",
      organizationId: "org-1",
      branchId: "branch-1",
      clientId: "client-1",
      siteId: "site-1",
      visibility: "INTERNAL",
      revision: 0,
      snapshot: { authoredByUserId: "guard-1" },
      history: [],
    },
  };

  it("shows progression, acknowledges once, and keeps history understandable", async () => {
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
      acknowledgedByUserId: "supervisor-1",
      acknowledgedByName: "Operations Manager B",
      acknowledgedAt: "2026-08-30T12:00:00.000Z",
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
      <OperationalRecordDetail
        state={detailState}
        actions={{
          acknowledge,
          amend: vi.fn(),
        }}
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: "Acknowledgement & amendment history",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Original values remain unchanged/i),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Acknowledge record" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(acknowledge).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getAllByText("Acknowledged").length).toBeGreaterThan(0),
    );
    expect(screen.getByText(/Operations Manager B/)).toBeInTheDocument();
    expect(screen.getByText(/Clarifies sequence/)).toBeInTheDocument();
  });

  it("requires amendment reason and corrected detail before appending", () => {
    const amend = vi.fn();
    render(
      <OperationalRecordDetail
        state={detailState}
        actions={{
          acknowledge: vi.fn(),
          amend,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record amendment" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      /Enter a reason and corrected detail/i,
    );
    expect(amend).not.toHaveBeenCalled();
  });
});
