import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReportingAnalyticsView } from "@/components/reporting/reporting-analytics";
import { buildReportingAnalytics } from "@/features/reporting-analytics/rollup";

const window = {
  startsAt: "2026-09-26T00:00:00.000Z",
  endsAt: "2026-09-27T00:00:00.000Z",
  asOf: "2026-09-27T00:00:00.000Z",
  timezone: "UTC" as const,
};

describe("NX-8.11 rendered reporting analytics", () => {
  afterEach(cleanup);
  it("shows the approved completion meaning, separate metrics, empty state, and bounded filter controls", () => {
    const analytics = buildReportingAnalytics(
      { assignments: [], incidents: [], exceptions: [] },
      false,
      { windowHours: 24 },
      window,
    );
    render(<ReportingAnalyticsView state={{ kind: "ready", analytics }} />);
    expect(screen.getByText(/Authorized portfolio/)).toBeTruthy();
    expect(
      screen.getByText("Submitted EOSR and required Activity Entry"),
    ).toBeTruthy();
    expect(
      screen.getAllByText("Not applicable — no eligible worked assignments")
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("No submitted incidents in this period."),
    ).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Period" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Site" })).toBeTruthy();
  });

  it("denies unauthorized access without rendering aggregates", () => {
    render(<ReportingAnalyticsView state={{ kind: "denied" }} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Submitted incidents")).toBeNull();
  });
});
