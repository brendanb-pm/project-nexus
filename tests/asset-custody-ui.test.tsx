import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetInventory } from "@/components/admin/asset-inventory";
import type { AssetPageState } from "@/features/assets/contracts";
afterEach(cleanup);
const state: Extract<AssetPageState, { kind: "ready" }> = {
  kind: "ready",
  canManage: true,
  sites: [
    { id: "site-1", name: "North", clientName: "Cedar", branchId: "branch-1" },
  ],
  employees: [
    { id: "employee-1", displayName: "Alex Guard", branchId: "branch-1" },
  ],
  assets: [
    {
      id: "asset-1",
      identifier: "RADIO-1",
      assetType: "radio",
      status: "active",
      condition: "good",
      siteId: "site-1",
      siteName: "North",
      clientName: "Cedar",
      updatedAt: "2026-09-11T00:00:00.000Z",
    },
  ],
  detail: {
    asset: {
      id: "asset-1",
      identifier: "RADIO-1",
      assetType: "radio",
      status: "active",
      condition: "good",
      siteId: "site-1",
      siteName: "North",
      clientName: "Cedar",
      updatedAt: "2026-09-11T00:00:00.000Z",
    },
    audit: [],
    custody: [],
  },
};
const actions = {
  createAsset: vi.fn(),
  updateAsset: vi.fn(),
  custodyAsset: vi.fn(),
};
describe("asset custody controls", () => {
  it("renders checkout controls with authorized choices and a required reason", () => {
    render(<AssetInventory state={state} actions={actions} />);
    expect(
      screen.getByRole("heading", { name: "Current custody" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Alex Guard" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("option", { name: /Cedar.*North/ }),
    ).toHaveLength(2);
    expect(screen.getByRole("textbox", { name: "Reason" })).toBeRequired();
    expect(
      screen.getByRole("option", { name: "Check out" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Check in" })).toBeNull();
  });
  it("renders transfer for a checked-out asset", () => {
    render(
      <AssetInventory
        state={{
          ...state,
          detail: {
            asset: {
              ...state.detail!.asset,
              siteId: undefined,
              siteName: undefined,
            },
            audit: [],
            custody: [
              {
                id: "custody-1",
                action: "CHECKOUT",
                occurredAt: "2026-09-11T00:00:00.000Z",
                fromSite: "North",
                toEmployee: "Alex Guard",
                actor: "Riley Ops",
                reason: "Start shift",
                condition: "good",
              },
            ],
          },
        }}
        actions={actions}
      />,
    );
    expect(
      screen.getByRole("option", { name: "Transfer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Check in" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Custody history" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/North.*Alex Guard/)).toBeInTheDocument();
    expect(screen.getByText(/Start shift.*Riley Ops/)).toBeInTheDocument();
  });
});
