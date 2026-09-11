"use client";
import { useState } from "react";
import {
  assetConditions,
  assetStatuses,
  assetTypes,
  type AssetPageState,
} from "@/features/assets/contracts";
const field =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2";
const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
type Actions = {
  createAsset(form: FormData): Promise<void>;
  updateAsset(form: FormData): Promise<void>;
};
function Select({
  name,
  values,
  value,
}: {
  name: string;
  values: readonly string[];
  value?: string;
}) {
  return (
    <select className={field} name={name} defaultValue={value}>
      {values.map((v) => (
        <option key={v} value={v}>
          {v.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
function AssetForm({
  state,
  actions,
}: {
  state: Extract<AssetPageState, { kind: "ready" }>;
  actions: Actions;
}) {
  const detail = state.detail?.asset;
  const editing = Boolean(detail);
  return (
    <form
      action={editing ? actions.updateAsset : actions.createAsset}
      className={`${panel} grid gap-3`}
    >
      <h2 className="text-lg font-semibold">
        {editing ? `Edit ${detail!.identifier}` : "Add asset"}
      </h2>
      {editing ? (
        <>
          <input type="hidden" name="assetId" value={detail!.id} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={detail!.updatedAt}
          />
        </>
      ) : null}
      <label>
        Identifier
        <input
          className={field}
          name="identifier"
          required
          defaultValue={detail?.identifier}
        />
      </label>
      <label>
        Asset type
        <Select
          name="assetType"
          values={assetTypes}
          value={detail?.assetType}
        />
      </label>
      <label>
        Status
        <Select name="status" values={assetStatuses} value={detail?.status} />
      </label>
      <label>
        Condition
        <Select
          name="condition"
          values={assetConditions}
          value={detail?.condition}
        />
      </label>
      <label>
        Inventory site
        <select
          className={field}
          name="siteId"
          required
          defaultValue={detail?.siteId}
        >
          {state.sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.clientName} — {site.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Inspection due
          <input
            className={field}
            name="inspectionDueOn"
            type="date"
            defaultValue={detail?.inspectionDueOn}
          />
        </label>
        <label>
          Expiry date
          <input
            className={field}
            name="expiresOn"
            type="date"
            defaultValue={detail?.expiresOn}
          />
        </label>
      </div>
      <button
        className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-black"
        type="submit"
      >
        {editing ? "Save inventory changes" : "Create asset"}
      </button>
      <p className="text-xs text-[var(--text-muted)]">
        Inventory details only. Checkout, check-in, transfer, and custodian
        changes are handled separately.
      </p>
    </form>
  );
}
export function AssetInventory({
  state,
  actions,
}: {
  state: AssetPageState;
  actions: Actions;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  if (state.kind !== "ready")
    return (
      <main className="mx-auto max-w-6xl p-6">
        <section className={panel} role="alert">
          <h1 className="text-xl font-semibold">Asset inventory unavailable</h1>
          <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
        </section>
      </main>
    );
  const filtered = state.assets.filter(
    (asset) =>
      (status === "ALL" || asset.status === status) &&
      `${asset.identifier} ${asset.assetType} ${asset.condition} ${asset.siteName ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6">
      <section className={panel}>
        <p className="text-sm text-[var(--text-muted)]">Operations</p>
        <h1 className="text-2xl font-semibold">Asset inventory</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Find and maintain organization-owned equipment. Custody workflows are
          not managed here.
        </p>
        <a
          className="mt-3 inline-block text-sm font-semibold underline"
          href="/admin/assets?new=1"
        >
          Add asset
        </a>
      </section>
      <section className={panel}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            Search assets
            <input
              className={field}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Identifier, type, site"
            />
          </label>
          <label>
            Status
            <select
              className={field}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              {assetStatuses.map((v) => (
                <option key={v} value={v}>
                  {v.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="grid gap-3" aria-live="polite">
        {filtered.length ? (
          filtered.map((asset) => (
            <a
              className={`${panel} block hover:border-white/30`}
              href={`/admin/assets?asset=${encodeURIComponent(asset.id)}`}
              key={asset.id}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{asset.identifier}</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {asset.assetType.replaceAll("_", " ")} ·{" "}
                    {asset.siteName ?? "Unassigned site"}
                  </p>
                </div>
                <p className="text-sm">
                  {asset.status.replaceAll("_", " ")} ·{" "}
                  {asset.condition.replaceAll("_", " ")}
                </p>
              </div>
            </a>
          ))
        ) : (
          <div className={panel}>No assets match these filters.</div>
        )}
      </section>
      <AssetForm state={state} actions={actions} />
      {state.detail ? (
        <section className={panel}>
          <h2 className="text-lg font-semibold">Administration history</h2>
          {state.detail.audit.length ? (
            <ul className="mt-3 grid gap-2 text-sm">
              {state.detail.audit.map((entry) => (
                <li key={entry.id}>
                  {entry.action.replace("asset.", "Asset ")} · {entry.actor} ·{" "}
                  {new Date(entry.occurredAt).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No inventory administration events have been recorded yet.
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}
