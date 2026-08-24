import Link from "next/link";
import type { ClientAdminPageState } from "@/features/client-admin/contracts";
import { SubmitButton } from "./submit-button";
const panel =
  "rounded-xl border border-white/10 bg-[var(--card)] p-5 shadow-sm";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2 text-[var(--text-primary)]";
export type ClientAdminActions = Record<
  | "createClient"
  | "updateClient"
  | "createContact"
  | "updateContact"
  | "createContract"
  | "updateContract",
  (form: FormData) => Promise<void>
>;
function State({
  state,
}: {
  state: Extract<
    ClientAdminPageState,
    { kind: "loading" | "permission-denied" | "error" }
  >;
}) {
  return (
    <section
      aria-busy={state.kind === "loading"}
      role={state.kind === "loading" ? "status" : "alert"}
      className={panel}
    >
      <h1 className="text-2xl font-semibold">
        {state.kind === "loading"
          ? "Loading client administration…"
          : state.kind === "permission-denied"
            ? "Access unavailable"
            : "Unable to load clients"}
      </h1>
      {state.kind !== "loading" ? (
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
      ) : null}
    </section>
  );
}
function StatusSelect({ value = "active" }: { value?: string }) {
  return (
    <select className={input} defaultValue={value} name="status">
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
  );
}
export function ClientAdmin({
  state,
  actions,
}: {
  state: ClientAdminPageState;
  actions?: ClientAdminActions;
}) {
  if (state.kind !== "ready") return <State state={state} />;
  const enabled = Boolean(actions) && state.canMutate;
  const detail = state.detail;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--accent)]">
          Administration
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          Clients, contacts & contracts
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Records are limited to your authorized organization, branches, and
          clients.
        </p>
        {!state.canMutate ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-white/10 p-3"
          >
            Read-only access. Client users cannot make administrative changes.
          </p>
        ) : null}
      </header>
      {state.canMutate ? (
        <section className={panel}>
          <h2 className="text-xl font-semibold">Add client</h2>
          {state.branches.length ? (
            <form
              action={actions?.createClient}
              className="mt-4 grid gap-4 md:grid-cols-3"
            >
              <label>
                <span className="text-sm">Branch</span>
                <select className={input} name="branchId">
                  {state.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.timezone}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm">Client name</span>
                <input className={input} maxLength={120} name="name" required />
              </label>
              <label>
                <span className="text-sm">Status</span>
                <StatusSelect />
              </label>
              <div className="md:col-span-3">
                <SubmitButton disabled={!enabled}>Add client</SubmitButton>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-[var(--text-muted)]">
              No active authorized branches are available. Activate a branch
              before adding a client.
            </p>
          )}
        </section>
      ) : null}
      <section className={panel}>
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold">Clients</h2>
          <span className="text-sm text-[var(--text-muted)]">
            {state.clients.items.length} shown
          </span>
        </div>
        {state.clients.items.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-white/15 p-5 text-[var(--text-muted)]">
            No clients are available in your authorized scope.
          </p>
        ) : (
          <nav className="mt-4 grid gap-2" aria-label="Clients">
            {state.clients.items.map((c) => (
              <Link
                className={`rounded-lg border p-3 ${detail?.client.id === c.id ? "border-[var(--accent)]" : "border-white/10"}`}
                href={`/admin/clients?client=${encodeURIComponent(c.id)}`}
                key={c.id}
              >
                <strong>{c.name}</strong>
                <span className="ml-2 text-sm text-[var(--text-muted)]">
                  {c.branchName} · {c.status}
                </span>
              </Link>
            ))}
          </nav>
        )}
        {state.clients.hasMore ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            More clients are available through bounded pagination.
          </p>
        ) : null}
      </section>
      {detail ? (
        <>
          <section className={panel}>
            <h2 className="text-xl font-semibold">{detail.client.name}</h2>
            <form
              action={actions?.updateClient}
              className="mt-4 grid gap-4 md:grid-cols-3"
            >
              <input type="hidden" name="clientId" value={detail.client.id} />
              <input
                type="hidden"
                name="expectedUpdatedAt"
                value={detail.client.updatedAt}
              />
              <label>
                <span className="text-sm">Branch</span>
                <select
                  className={input}
                  defaultValue={detail.client.branchId}
                  disabled={!state.canMutate}
                  name="branchId"
                >
                  {state.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.timezone}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm">Name</span>
                <input
                  className={input}
                  defaultValue={detail.client.name}
                  disabled={!state.canMutate}
                  name="name"
                  required
                />
              </label>
              <label>
                <span className="text-sm">Status</span>
                <StatusSelect value={detail.client.status} />
              </label>
              <div className="md:col-span-3">
                <SubmitButton disabled={!enabled}>Save client</SubmitButton>
              </div>
            </form>
          </section>
          <section className={panel}>
            <h2 className="text-xl font-semibold">Contacts</h2>
            {state.canMutate ? (
              <form
                action={actions?.createContact}
                className="mt-4 grid gap-3 md:grid-cols-4"
              >
                <input type="hidden" name="clientId" value={detail.client.id} />
                <input
                  className={input}
                  name="name"
                  placeholder="Contact name"
                  required
                />
                <input
                  className={input}
                  name="email"
                  type="email"
                  placeholder="Email (optional)"
                />
                <input
                  className={input}
                  name="phone"
                  type="tel"
                  placeholder="Phone (optional)"
                />
                <StatusSelect />
                <div className="md:col-span-4">
                  <SubmitButton disabled={!enabled}>Add contact</SubmitButton>
                </div>
              </form>
            ) : null}
            {detail.contacts.length === 0 ? (
              <p className="mt-4 text-[var(--text-muted)]">
                No contacts have been recorded.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {detail.contacts.map((c) => (
                  <form
                    action={actions?.updateContact}
                    className="grid gap-3 rounded-lg border border-white/10 p-3 md:grid-cols-4"
                    key={c.id}
                  >
                    <input type="hidden" name="contactId" value={c.id} />
                    <input type="hidden" name="clientId" value={c.clientId} />
                    <input
                      type="hidden"
                      name="expectedUpdatedAt"
                      value={c.updatedAt}
                    />
                    <input
                      className={input}
                      defaultValue={c.name}
                      disabled={!state.canMutate}
                      name="name"
                      required
                    />
                    <input
                      className={input}
                      defaultValue={c.email}
                      disabled={!state.canMutate}
                      name="email"
                      type="email"
                    />
                    <input
                      className={input}
                      defaultValue={c.phone}
                      disabled={!state.canMutate}
                      name="phone"
                    />
                    <StatusSelect value={c.status} />
                    <div className="md:col-span-4">
                      <SubmitButton disabled={!enabled}>
                        Save contact
                      </SubmitButton>
                    </div>
                  </form>
                ))}
              </div>
            )}
          </section>
          <section className={panel}>
            <h2 className="text-xl font-semibold">Contracts</h2>
            {state.canMutate ? (
              <form
                action={actions?.createContract}
                className="mt-4 grid gap-3 md:grid-cols-4"
              >
                <input type="hidden" name="clientId" value={detail.client.id} />
                <input
                  className={input}
                  name="name"
                  placeholder="Contract name"
                  required
                />
                <input className={input} name="startsOn" type="date" required />
                <input className={input} name="endsOn" type="date" />
                <select className={input} defaultValue="draft" name="status">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="terminated">Terminated</option>
                </select>
                <div className="md:col-span-4">
                  <SubmitButton disabled={!enabled}>Add contract</SubmitButton>
                </div>
              </form>
            ) : null}
            {detail.contracts.length === 0 ? (
              <p className="mt-4 text-[var(--text-muted)]">
                No contracts have been recorded.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {detail.contracts.map((c) => (
                  <form
                    action={actions?.updateContract}
                    className="grid gap-3 rounded-lg border border-white/10 p-3 md:grid-cols-4"
                    key={c.id}
                  >
                    <input type="hidden" name="contractId" value={c.id} />
                    <input type="hidden" name="clientId" value={c.clientId} />
                    <input
                      type="hidden"
                      name="expectedUpdatedAt"
                      value={c.updatedAt}
                    />
                    <input
                      className={input}
                      defaultValue={c.name}
                      disabled={!state.canMutate}
                      name="name"
                      required
                    />
                    <input
                      className={input}
                      defaultValue={c.startsOn}
                      disabled={!state.canMutate}
                      name="startsOn"
                      type="date"
                      required
                    />
                    <input
                      className={input}
                      defaultValue={c.endsOn}
                      disabled={!state.canMutate}
                      name="endsOn"
                      type="date"
                    />
                    <select
                      className={input}
                      defaultValue={c.status}
                      disabled={!state.canMutate}
                      name="status"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="terminated">Terminated</option>
                    </select>
                    <div className="md:col-span-4">
                      <SubmitButton disabled={!enabled}>
                        Save contract
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
