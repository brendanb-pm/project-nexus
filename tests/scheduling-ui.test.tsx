import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SchedulingAdmin } from "@/components/admin/scheduling-admin";
import { MySchedule } from "@/components/schedule/my-schedule";
import type {
  AssignmentSummary,
  SchedulingAdminPageState,
} from "@/features/scheduling/contracts";

const shift = {
  id: "shift-1",
  organizationId: "org-1",
  postId: "post-1",
  siteId: "site-1",
  clientId: "client-1",
  branchId: "branch-1",
  postName: "Lobby",
  siteName: "Cedar Plaza",
  timezone: "America/Los_Angeles",
  scheduledStart: "2026-11-08T06:00:00.000Z",
  scheduledEnd: "2026-11-08T14:00:00.000Z",
  staffingRequirement: 2,
  assignedCount: 1,
  status: "PUBLISHED" as const,
  updatedAt: "2026-08-29T00:00:00.000Z",
};
const assignment: AssignmentSummary = {
  id: "assignment-1",
  organizationId: "org-1",
  shiftId: shift.id,
  employeeId: "employee-1",
  employeeNumber: "NPS-100",
  shift,
  status: "assigned",
  availability: "UNKNOWN",
  warnings: ["No availability was declared for this interval."],
  assignedAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
};
const adminState: SchedulingAdminPageState = {
  kind: "ready",
  shifts: { items: [shift], hasMore: false },
  assignments: [assignment],
  posts: [
    {
      id: "post-1",
      name: "Lobby",
      siteName: "Cedar Plaza",
      timezone: "America/Los_Angeles",
    },
  ],
  employees: [
    {
      id: "employee-1",
      employeeNumber: "NPS-100",
      displayName: "Alex Guard",
    },
  ],
};

describe("Sprint 2 scheduling UI", () => {
  it("presents human-readable post and employee choices without operator-entered IDs", () => {
    render(
      <SchedulingAdmin
        actions={{ createShift: vi.fn(), assignEmployee: vi.fn() }}
        state={adminState}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Shift scheduling" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Cedar Plaza.*Lobby/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Alex Guard.*NPS-100/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/post's local timezone/i)).toBeInTheDocument();
  });

  it("renders stable permission-denied state", () => {
    render(
      <SchedulingAdmin
        state={{ kind: "permission-denied", message: "Not authorized." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Not authorized");
  });

  it("explains one-time location privacy and renders clock actions", () => {
    render(
      <MySchedule
        actions={{ createAvailability: vi.fn(), clock: vi.fn() }}
        state={{ kind: "ready", assignments: [assignment], availability: [] }}
      />,
    );
    expect(
      screen.getByText(/does not track location continuously/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clock in" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clock out" }),
    ).not.toBeInTheDocument();
  });

  it("renders an actionable empty assignment state", () => {
    render(
      <MySchedule
        state={{ kind: "ready", assignments: [], availability: [] }}
      />,
    );
    expect(
      screen.getByText(/No assignments are currently scheduled/i),
    ).toBeInTheDocument();
  });
});
