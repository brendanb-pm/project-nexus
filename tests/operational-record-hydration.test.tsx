import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OperationalRecordDetail } from "@/components/operations/operational-record-detail";
import type { OperationalRecordDetailState } from "@/features/operations/record-detail";

const state: OperationalRecordDetailState = {
  kind: "ready",
  record: {
    key: "activity:demo",
    family: "activity",
    id: "demo",
    typeLabel: "Activity / DAR",
    siteName: "Cedar Plaza North",
    postName: "North Lobby",
    timestamp: "2026-09-25T12:00:00.000Z",
    actorName: "Guard A",
    status: "AWAITING ACKNOWLEDGEMENT",
    summary: "Routine patrol",
    href: "/operations/records/activity/demo",
    actionable: true,
  },
  fields: [{ label: "Narrative", value: "Routine patrol" }],
  review: {
    entityType: "ActivityEntry",
    id: "demo",
    organizationId: "org",
    branchId: "branch",
    clientId: "client",
    siteId: "site",
    visibility: "INTERNAL",
    revision: 0,
    snapshot: {},
    history: [],
  },
};

const actions = {
  acknowledge: async () => state.review!,
  amend: async () => state.review!,
};

describe("Operational record hydration guard", () => {
  it("does not expose editable controls before hydration and enables them after", () => {
    const html = renderToString(
      <OperationalRecordDetail state={state} actions={actions} />,
    );
    expect(html).toMatch(/disabled=""[^>]*>Record amendment/);
    render(<OperationalRecordDetail state={state} actions={actions} />);
    expect(screen.getByLabelText("Amendment reason")).toBeEnabled();
    expect(screen.getByLabelText("Corrected detail")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Record amendment" }),
    ).toBeEnabled();
  });
});
