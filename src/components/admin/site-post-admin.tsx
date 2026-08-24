import Link from "next/link";
import { serviceTypes } from "@/domain/model";
import type {
  SiteAdminPageState,
  SiteSummary,
} from "@/features/site-admin/contracts";
import { SubmitButton } from "./submit-button";
const panel =
  "rounded-xl border border-white/10 bg-[var(--card)] p-5 shadow-sm";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2 text-[var(--text-primary)]";
export type SiteAdminActions = Record<
  "createSite" | "updateSite" | "createPost" | "updatePost",
  (form: FormData) => Promise<void>
>;
function Lifecycle({
  value = "active",
  disabled = false,
}: {
  value?: string;
  disabled?: boolean;
}) {
  return (
    <select
      className={input}
      defaultValue={value}
      disabled={disabled}
      name="status"
    >
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
  );
}
function SiteFields({
  site,
  disabled,
}: {
  site?: SiteSummary;
  disabled?: boolean;
}) {
  return (
    <>
      <label>
        <span className="text-sm">Site name</span>
        <input
          className={input}
          defaultValue={site?.name}
          disabled={disabled}
          maxLength={120}
          name="name"
          required
        />
      </label>
      <label>
        <span className="text-sm">Street address</span>
        <input
          className={input}
          defaultValue={site?.addressLine1}
          disabled={disabled}
          name="addressLine1"
          required
        />
      </label>
      <label>
        <span className="text-sm">City</span>
        <input
          className={input}
          defaultValue={site?.city}
          disabled={disabled}
          name="city"
          required
        />
      </label>
      <label>
        <span className="text-sm">State / region</span>
        <input
          className={input}
          defaultValue={site?.region}
          disabled={disabled}
          name="region"
          required
        />
      </label>
      <label>
        <span className="text-sm">Postal code</span>
        <input
          className={input}
          defaultValue={site?.postalCode}
          disabled={disabled}
          name="postalCode"
          required
        />
      </label>
      <label>
        <span className="text-sm">Country code</span>
        <input
          className={input}
          defaultValue={site?.country ?? "US"}
          disabled={disabled}
          maxLength={2}
          name="country"
          required
        />
      </label>
      <label>
        <span className="text-sm">Timezone</span>
        <input
          className={input}
          defaultValue={site?.timezone ?? "America/Los_Angeles"}
          disabled={disabled}
          name="timezone"
          required
        />
      </label>
      <label>
        <span className="text-sm">Latitude (optional)</span>
        <input
          className={input}
          defaultValue={site?.latitude}
          disabled={disabled}
          name="latitude"
          step="any"
          type="number"
        />
      </label>
      <label>
        <span className="text-sm">Longitude (optional)</span>
        <input
          className={input}
          defaultValue={site?.longitude}
          disabled={disabled}
          name="longitude"
          step="any"
          type="number"
        />
      </label>
      <label>
        <span className="text-sm">Geofence radius, meters (storage only)</span>
        <input
          className={input}
          defaultValue={site?.geofenceRadiusMeters}
          disabled={disabled}
          max={5000}
          min={10}
          name="geofenceRadiusMeters"
          type="number"
        />
      </label>
      <label>
        <span className="text-sm">Status</span>
        <Lifecycle value={site?.status} disabled={disabled} />
      </label>
    </>
  );
}
export function SitePostAdmin({
  state,
  actions,
}: {
  state: SiteAdminPageState;
  actions?: SiteAdminActions;
}) {
  if (state.kind !== "ready")
    return (
      <section
        aria-busy={state.kind === "loading"}
        role={state.kind === "loading" ? "status" : "alert"}
        className={panel}
      >
        <h1 className="text-2xl font-semibold">
          {state.kind === "loading"
            ? "Loading site administration…"
            : state.kind === "permission-denied"
              ? "Access unavailable"
              : "Unable to load sites"}
        </h1>
        {state.kind !== "loading" ? (
          <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
        ) : null}
      </section>
    );
  const detail = state.detail;
  const siteEnabled = Boolean(actions) && state.canManageSites;
  const postEnabled = Boolean(actions) && state.canManagePosts;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">
          Administration
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Sites & posts</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Posts remain distinct staffed positions within an authorized client
          site.
        </p>
      </header>
      {state.canManageSites ? (
        <section className={panel}>
          <h2 className="text-xl font-semibold">Add site</h2>
          {state.clients.length ? (
            <form
              action={actions?.createSite}
              className="mt-4 grid gap-3 md:grid-cols-3"
            >
              <label>
                <span className="text-sm">Client</span>
                <select className={input} name="clientId">
                  {state.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.branchName}
                    </option>
                  ))}
                </select>
              </label>
              <SiteFields />
              <div className="md:col-span-3">
                <SubmitButton disabled={!siteEnabled}>Add site</SubmitButton>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-[var(--text-muted)]">
              No active authorized clients are available.
            </p>
          )}
        </section>
      ) : null}
      <section className={panel}>
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold">Sites</h2>
          <span className="text-sm text-[var(--text-muted)]">
            {state.sites.items.length} shown
          </span>
        </div>
        {state.sites.items.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-white/15 p-5 text-[var(--text-muted)]">
            No sites are available in your authorized scope.
          </p>
        ) : (
          <nav className="mt-4 grid gap-2">
            {state.sites.items.map((s) => (
              <Link
                className={`rounded-lg border p-3 ${detail?.site.id === s.id ? "border-[var(--accent)]" : "border-white/10"}`}
                href={`/admin/sites?site=${encodeURIComponent(s.id)}`}
                key={s.id}
              >
                <strong>{s.name}</strong>
                <span className="ml-2 text-sm text-[var(--text-muted)]">
                  {s.clientName} · {s.city} · {s.status}
                </span>
              </Link>
            ))}
          </nav>
        )}
        {state.sites.hasMore ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            More sites are available through bounded pagination.
          </p>
        ) : null}
      </section>
      {detail ? (
        <>
          <section className={panel}>
            <h2 className="text-xl font-semibold">{detail.site.name}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Client: {detail.site.clientName}
            </p>
            <form
              action={actions?.updateSite}
              className="mt-4 grid gap-3 md:grid-cols-3"
            >
              <input type="hidden" name="siteId" value={detail.site.id} />
              <input
                type="hidden"
                name="clientId"
                value={detail.site.clientId}
              />
              <input
                type="hidden"
                name="expectedUpdatedAt"
                value={detail.site.updatedAt}
              />
              <SiteFields site={detail.site} disabled={!state.canManageSites} />
              <div className="md:col-span-3">
                <SubmitButton disabled={!siteEnabled}>Save site</SubmitButton>
              </div>
            </form>
          </section>
          <section className={panel}>
            <h2 className="text-xl font-semibold">Posts</h2>
            {state.canManagePosts ? (
              <form
                action={actions?.createPost}
                className="mt-4 grid gap-3 md:grid-cols-3"
              >
                <input type="hidden" name="siteId" value={detail.site.id} />
                <input
                  className={input}
                  name="name"
                  placeholder="Post name, e.g. Front desk"
                  required
                />
                <input
                  className={input}
                  name="description"
                  placeholder="Staffed-position description"
                  required
                />
                <select className={input} name="serviceType">
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <select
                  className={input}
                  defaultValue="unarmed"
                  name="armedRequirement"
                >
                  <option value="unarmed">Unarmed</option>
                  <option value="armed">Armed</option>
                  <option value="either">Either</option>
                </select>
                <textarea
                  className={input}
                  name="qualificationRequirements"
                  placeholder="Qualifications, one per line"
                />
                <Lifecycle />
                <div className="md:col-span-3">
                  <SubmitButton disabled={!postEnabled}>Add post</SubmitButton>
                </div>
              </form>
            ) : null}
            {detail.posts.length === 0 ? (
              <p className="mt-4 text-[var(--text-muted)]">
                No staffed posts have been defined for this site.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {detail.posts.map((p) => (
                  <form
                    action={actions?.updatePost}
                    className="grid gap-3 rounded-lg border border-white/10 p-3 md:grid-cols-3"
                    key={p.id}
                  >
                    <input type="hidden" name="postId" value={p.id} />
                    <input type="hidden" name="siteId" value={p.siteId} />
                    <input
                      type="hidden"
                      name="expectedUpdatedAt"
                      value={p.updatedAt}
                    />
                    <input
                      className={input}
                      defaultValue={p.name}
                      disabled={!state.canManagePosts}
                      name="name"
                      required
                    />
                    <input
                      className={input}
                      defaultValue={p.description}
                      disabled={!state.canManagePosts}
                      name="description"
                      required
                    />
                    <select
                      className={input}
                      defaultValue={p.serviceType}
                      disabled={!state.canManagePosts}
                      name="serviceType"
                    >
                      {serviceTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                    <select
                      className={input}
                      defaultValue={p.armedRequirement}
                      disabled={!state.canManagePosts}
                      name="armedRequirement"
                    >
                      <option value="unarmed">Unarmed</option>
                      <option value="armed">Armed</option>
                      <option value="either">Either</option>
                    </select>
                    <textarea
                      className={input}
                      defaultValue={p.qualificationRequirements.join("\n")}
                      disabled={!state.canManagePosts}
                      name="qualificationRequirements"
                    />
                    <Lifecycle
                      value={p.status}
                      disabled={!state.canManagePosts}
                    />
                    <div className="md:col-span-3">
                      <SubmitButton disabled={!postEnabled}>
                        Save post
                      </SubmitButton>
                    </div>
                  </form>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
