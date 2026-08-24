import type { OrganizationAdminPageState } from "@/features/organization-admin/contracts";
import { SubmitButton } from "./submit-button";
import { SignOutButton } from "@/components/auth/sign-out-button";

export type OrganizationAdminActions = {
  updateOrganization(formData: FormData): Promise<void>;
  createBranch(formData: FormData): Promise<void>;
  updateBranch(formData: FormData): Promise<void>;
};

const panel =
  "rounded-xl border border-white/10 bg-[var(--card)] p-5 shadow-sm";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2 text-[var(--text-primary)]";

export function OrganizationBranchAdmin({
  state,
  actions,
}: Readonly<{
  state: OrganizationAdminPageState;
  actions?: OrganizationAdminActions;
}>) {
  if (state.kind === "loading") {
    return (
      <section aria-busy="true" aria-live="polite" className={panel}>
        Loading organization administration…
      </section>
    );
  }

  if (state.kind === "permission-denied") {
    return (
      <section className={panel} role="alert">
        <h1 className="text-2xl font-semibold">Access unavailable</h1>
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section className={panel} role="alert">
        <h1 className="text-2xl font-semibold">
          Unable to load administration
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
        {state.retryable ? (
          <p className="mt-3 text-sm">Retry by refreshing this page.</p>
        ) : null}
      </section>
    );
  }

  const enabled = Boolean(actions);
  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">
            Administration
          </p>
          <SignOutButton />
        </div>
        <h1 className="mt-2 text-3xl font-semibold">Organization & branches</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Manage the provider profile and its operating branches.
        </p>
      </header>

      {state.notice ? (
        <section
          aria-live="polite"
          className={panel}
          role={state.notice.kind === "success" ? "status" : "alert"}
        >
          <p>{state.notice.message}</p>
          {state.notice.fieldErrors ? (
            <ul className="mt-2 list-disc pl-5 text-sm text-[var(--text-muted)]">
              {Object.entries(state.notice.fieldErrors).flatMap(
                ([field, messages]) =>
                  messages.map((message) => (
                    <li key={`${field}-${message}`}>{message}</li>
                  )),
              )}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className={panel}>
        <h2 className="text-xl font-semibold">Organization</h2>
        <form action={actions?.updateOrganization} className="mt-4 grid gap-4">
          <input
            name="expectedUpdatedAt"
            type="hidden"
            value={state.organization.updatedAt}
          />
          <label>
            <span className="text-sm">Organization name</span>
            <input
              className={input}
              defaultValue={state.organization.name}
              maxLength={120}
              name="name"
              required
            />
          </label>
          <label>
            <span className="text-sm">Status</span>
            <select
              className={input}
              defaultValue={state.organization.status}
              name="status"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <div>
            <SubmitButton disabled={!enabled}>Save organization</SubmitButton>
          </div>
        </form>
      </section>

      <section className={panel}>
        <h2 className="text-xl font-semibold">Add branch</h2>
        <form
          action={actions?.createBranch}
          className="mt-4 grid gap-4 md:grid-cols-3"
        >
          <label>
            <span className="text-sm">Branch name</span>
            <input className={input} maxLength={120} name="name" required />
          </label>
          <label>
            <span className="text-sm">Timezone</span>
            <input
              className={input}
              maxLength={80}
              name="timezone"
              placeholder="America/Los_Angeles"
              required
            />
          </label>
          <label>
            <span className="text-sm">Status</span>
            <select className={input} defaultValue="active" name="status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <div className="md:col-span-3">
            <SubmitButton disabled={!enabled}>Add branch</SubmitButton>
          </div>
        </form>
      </section>

      <section className={panel}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Branches</h2>
          <span className="text-sm text-[var(--text-muted)]">
            {state.branches.items.length} shown
          </span>
        </div>
        {state.branches.items.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-white/15 p-5 text-[var(--text-muted)]">
            No branches yet. Add the first branch above.
          </p>
        ) : (
          <div className="mt-4 grid gap-4">
            {state.branches.items.map((branch) => (
              <form
                action={actions?.updateBranch}
                className="grid gap-3 rounded-lg border border-white/10 p-4 md:grid-cols-3"
                key={branch.id}
              >
                <input name="branchId" type="hidden" value={branch.id} />
                <input
                  name="expectedUpdatedAt"
                  type="hidden"
                  value={branch.updatedAt}
                />
                <label>
                  <span className="text-sm">Branch name</span>
                  <input
                    className={input}
                    defaultValue={branch.name}
                    maxLength={120}
                    name="name"
                    required
                  />
                </label>
                <label>
                  <span className="text-sm">Timezone</span>
                  <input
                    className={input}
                    defaultValue={branch.timezone}
                    maxLength={80}
                    name="timezone"
                    required
                  />
                </label>
                <label>
                  <span className="text-sm">Status</span>
                  <select
                    className={input}
                    defaultValue={branch.status}
                    name="status"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <div className="md:col-span-3">
                  <SubmitButton disabled={!enabled}>Save branch</SubmitButton>
                </div>
              </form>
            ))}
          </div>
        )}
        {state.branches.nextCursor ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            More branches are available through the next bounded page.
          </p>
        ) : null}
      </section>
    </div>
  );
}
