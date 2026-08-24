import Link from "next/link";
import type {
  EmployeeSummary,
  PeopleAdminPageState,
} from "@/features/people-admin/contracts";
import { SubmitButton } from "./submit-button";
const panel =
  "rounded-xl border border-white/10 bg-[var(--card)] p-5 shadow-sm";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2 text-[var(--text-primary)]";
export type PeopleAdminActions = Record<
  "createEmployee" | "updateEmployee",
  (form: FormData) => Promise<void>
>;
function Status({
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
      name="employmentStatus"
    >
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
  );
}
function Fields({
  employee,
  state,
  disabled,
}: {
  employee?: EmployeeSummary;
  state: Extract<PeopleAdminPageState, { kind: "ready" }>;
  disabled?: boolean;
}) {
  return (
    <>
      <label>
        <span className="text-sm">Employee number</span>
        <input
          className={input}
          defaultValue={employee?.employeeNumber}
          disabled={disabled}
          maxLength={48}
          name="employeeNumber"
          required
        />
      </label>
      <label>
        <span className="text-sm">Display name</span>
        <input
          className={input}
          defaultValue={employee?.displayName}
          disabled={disabled}
          maxLength={120}
          name="displayName"
          required
        />
      </label>
      <label>
        <span className="text-sm">Work phone (optional)</span>
        <input
          className={input}
          defaultValue={employee?.workPhone}
          disabled={disabled}
          maxLength={32}
          name="workPhone"
          type="tel"
        />
      </label>
      <label>
        <span className="text-sm">Primary branch</span>
        <select
          className={input}
          defaultValue={employee?.primaryBranchId}
          disabled={disabled}
          name="primaryBranchId"
          required
        >
          {state.branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} — {branch.timezone}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-sm">Application user (optional)</span>
        <select
          className={input}
          defaultValue={employee?.user?.id ?? ""}
          disabled={disabled}
          name="userId"
        >
          <option value="">No linked application user</option>
          {employee?.user ? (
            <option value={employee.user.id}>
              {employee.user.email} — {employee.user.status}
            </option>
          ) : null}
          {state.users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.email} — {user.status}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-[var(--text-muted)]">
          Linking does not create an external identity or grant access.
        </span>
      </label>
      <label>
        <span className="text-sm">Employment status</span>
        <Status disabled={disabled} value={employee?.employmentStatus} />
      </label>
    </>
  );
}
export function PeopleAdmin({
  state,
  actions,
}: {
  state: PeopleAdminPageState;
  actions?: PeopleAdminActions;
}) {
  if (state.kind === "loading")
    return (
      <main aria-busy="true" className="p-6" role="status">
        Loading employee administration…
      </main>
    );
  if (state.kind === "permission-denied")
    return (
      <main className="p-6">
        <section className={panel} role="alert">
          <h1 className="text-xl font-semibold">Access unavailable</h1>
          <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
        </section>
      </main>
    );
  if (state.kind === "error")
    return (
      <main className="p-6">
        <section className={panel} role="alert">
          <h1 className="text-xl font-semibold">
            Employee administration unavailable
          </h1>
          <p className="mt-2 text-[var(--text-muted)]">
            {state.message}
            {state.retryable ? " Please try again." : ""}
          </p>
        </section>
      </main>
    );
  const enabled = state.canManage && Boolean(actions);
  return (
    <div className="grid gap-6">
      <section className={panel}>
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Personnel records are organization-scoped. Application access requires
          separate active membership and identity setup.
        </p>
        {state.canManage ? (
          <form
            action={actions?.createEmployee}
            className="mt-5 grid gap-3 md:grid-cols-3"
          >
            <Fields disabled={!enabled} state={state} />
            <div className="md:col-span-3">
              <SubmitButton disabled={!enabled}>Add employee</SubmitButton>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            Read-only compliance access.
          </p>
        )}
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Authorized employees</h2>
        {state.employees.items.length === 0 ? (
          <p className="mt-3 text-[var(--text-muted)]">
            No employees are available in your authorized scope.
          </p>
        ) : (
          <nav className="mt-3 grid gap-2">
            {state.employees.items.map((employee) => (
              <Link
                className="rounded-lg border border-white/10 p-3 hover:border-[var(--accent)]"
                href={`/admin/employees?employee=${encodeURIComponent(employee.id)}`}
                key={employee.id}
              >
                <strong>{employee.displayName}</strong>
                <span className="ml-2 text-sm text-[var(--text-muted)]">
                  {employee.employeeNumber} · {employee.primaryBranchName} ·{" "}
                  {employee.employmentStatus}
                </span>
              </Link>
            ))}
          </nav>
        )}
        {state.employees.hasMore ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            More employees are available through bounded pagination.
          </p>
        ) : null}
      </section>
      {state.detail ? (
        <section className={panel}>
          <h2 className="text-xl font-semibold">{state.detail.displayName}</h2>
          {state.canManage ? (
            <form
              action={actions?.updateEmployee}
              className="mt-4 grid gap-3 md:grid-cols-3"
            >
              <input name="employeeId" type="hidden" value={state.detail.id} />
              <input
                name="expectedUpdatedAt"
                type="hidden"
                value={state.detail.updatedAt}
              />
              <Fields
                disabled={!enabled}
                employee={state.detail}
                state={state}
              />
              <div className="md:col-span-3">
                <SubmitButton disabled={!enabled}>Save employee</SubmitButton>
              </div>
            </form>
          ) : (
            <p className="mt-3 text-[var(--text-muted)]">
              Sensitive employee details require employee-management permission.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
