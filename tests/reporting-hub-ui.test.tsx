import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReportingHub } from "@/components/reporting/reporting-hub";
import type { ReportHubPageState } from "@/features/reporting-hub/contracts";

afterEach(cleanup);

const internal: ReportHubPageState = {
  kind: "internal",
  scopeLabel: "Authorized portfolio",
  sites: [{ id: "00000000-0000-4000-8000-000000008607", name: "Harbor Site" }],
  sitesLimited: false,
  filters: {
    siteId: "00000000-0000-4000-8000-000000008607",
    family: "activity",
    windowHours: 24,
  },
  rows: [
    {
      id: "00000000-0000-4000-8000-000000008608",
      family: "activity",
      familyLabel: "Activity Entry",
      siteId: "00000000-0000-4000-8000-000000008607",
      siteName: "Harbor Site",
      postName: "Gate",
      timestamp: "2026-09-22T11:00:00.000Z",
      status: "SUBMITTED",
      summary: "Completed perimeter inspection.",
      href: "/operations/records/activity/00000000-0000-4000-8000-000000008608",
    },
  ],
  hasMore: true,
  nextCursor: "2026-09-22T11:00:00.000Z|00000000-0000-4000-8000-000000008608",
};

describe("NX-8.6 Reporting Hub presentation", () => {
  it.each([
    ["guard", "Your Shift Report", "/reporting"],
    ["client", "Client reporting", "/portal"],
    ["leadership", "Leadership operations", "/leadership"],
  ] as const)(
    "renders the %s canonical product without cross-role data",
    (kind, title, href) => {
      render(<ReportingHub state={{ kind }} />);
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: new RegExp(title, "i") }),
      ).toHaveAttribute("href", href);
      expect(
        screen.queryByText("Operational reporting browse"),
      ).not.toBeInTheDocument();
    },
  );

  it("renders accessible bounded filters, canonical deep links, and explicit paging", () => {
    render(<ReportingHub state={internal} />);
    expect(screen.getByLabelText("Site")).toHaveValue(
      "00000000-0000-4000-8000-000000008607",
    );
    expect(screen.getByLabelText("Record family")).toHaveValue("activity");
    expect(screen.getByLabelText("Time range")).toHaveValue("24");
    expect(
      screen.getByText(/bounded to 50 records per page/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Harbor Site/i })).toHaveAttribute(
      "href",
      "/operations/records/activity/00000000-0000-4000-8000-000000008608",
    );
    const next = screen.getByRole("link", { name: "View next 50 records" });
    expect(next.getAttribute("href")).toContain(
      "siteId=00000000-0000-4000-8000-000000008607",
    );
    expect(next.getAttribute("href")).toContain("family=activity");
    expect(next.getAttribute("href")).toContain("cursor=");
  });

  it("renders explicit empty, denied, and error states", () => {
    const { rerender } = render(
      <ReportingHub
        state={{ ...internal, rows: [], hasMore: false, nextCursor: undefined }}
      />,
    );
    expect(
      screen.getByText("No matching reporting records"),
    ).toBeInTheDocument();
    rerender(<ReportingHub state={{ kind: "denied" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("does not have access");
    rerender(
      <ReportingHub state={{ kind: "error", message: "Temporary failure" }} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Temporary failure");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/reports",
    );
  });
});
