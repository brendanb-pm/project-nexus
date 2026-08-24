import Link from "next/link";
import type {
  ComplianceAdminPageState,
  ComplianceSummary,
} from "@/features/compliance-admin/contracts";
import { SubmitButton } from "./submit-button";
const panel =
  "rounded-xl border border-white/10 bg-[var(--card)] p-5 shadow-sm";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2 text-[var(--text-primary)]";
export type ComplianceAdminActions = Record<
  | "createCredential"
  | "createCertification"
  | "updateCredential"
  | "updateCertification"
  | "verifyCredential"
  | "verifyCertification"
  | "renewCredential"
  | "renewCertification",
  (form: FormData) => Promise<void>
>;
function Status({ value = "pending_verification" }: { value?: string }) {
  return (
    <select className={input} defaultValue={value} name="status">
      <option value="pending_verification">Pending verification</option>
      <option value="active">Active</option>
      <option value="expired">Expired</option>
      <option value="suspended">Suspended</option>
      <option value="revoked">Revoked</option>
    </select>
  );
}
function Fields({
  record,
  credential,
}: {
  record?: ComplianceSummary;
  credential: boolean;
}) {
  return (
    <>
      <label>
        <span className="text-sm">Type</span>
        <input
          className={input}
          defaultValue={record?.type}
          name="type"
          required
        />
      </label>
      {credential ? (
        <label>
          <span className="text-sm">Identifier (optional)</span>
          <input
            className={input}
            defaultValue={record?.identifier}
            name="identifier"
          />
        </label>
      ) : null}
      <label>
        <span className="text-sm">Issuing authority</span>
        <input
          className={input}
          defaultValue={record?.issuingAuthority}
          name="issuingAuthority"
          required
        />
      </label>
      <label>
        <span className="text-sm">Issued / completed</span>
        <input
          className={input}
          defaultValue={record?.issuedOn}
          name="issuedOn"
          type="date"
          required
        />
      </label>
      <label>
        <span className="text-sm">Expiration (optional)</span>
        <input
          className={input}
          defaultValue={record?.expiresOn}
          name="expiresOn"
          type="date"
        />
      </label>
      <label>
        <span className="text-sm">Status</span>
        <Status value={record?.status} />
      </label>
      <label>
        <span className="text-sm">
          Non-secret document reference (optional)
        </span>
        <input
          className={input}
          defaultValue={record?.documentReference}
          name="documentReference"
        />
      </label>
    </>
  );
}
function Records({
  title,
  records,
  kind,
  employeeId,
  canManage,
  actions,
}: {
  title: string;
  records: readonly ComplianceSummary[];
  kind: "credential" | "certification";
  employeeId: string;
  canManage: boolean;
  actions?: ComplianceAdminActions;
}) {
  const actionNames =
    kind === "credential"
      ? ({
          create: "createCredential",
          update: "updateCredential",
          verify: "verifyCredential",
          renew: "renewCredential",
        } as const)
      : ({
          create: "createCertification",
          update: "updateCertification",
          verify: "verifyCertification",
          renew: "renewCertification",
        } as const);
  const enabled = canManage && Boolean(actions);
  return (
    <section className={panel}>
      <h2 className="text-xl font-semibold">{title}</h2>
      {canManage ? (
        <form
          action={actions?.[actionNames.create]}
          className="mt-4 grid gap-3 md:grid-cols-3"
        >
          <input name="employeeId" type="hidden" value={employeeId} />
          <Fields credential={kind === "credential"} />
          <div className="md:col-span-3">
            <SubmitButton disabled={!enabled}>Add {kind}</SubmitButton>
          </div>
        </form>
      ) : null}
      {records.length === 0 ? (
        <p className="mt-4 text-[var(--text-muted)]">
          No {title.toLocaleLowerCase()} have been recorded.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {records.map((record) => (
            <div
              className="rounded-lg border border-white/10 p-3"
              key={record.id}
            >
              <form
                action={actions?.[actionNames.update]}
                className="grid gap-3 md:grid-cols-3"
              >
                <input name="recordId" type="hidden" value={record.id} />
                <input name="employeeId" type="hidden" value={employeeId} />
                <input
                  name="expectedUpdatedAt"
                  type="hidden"
                  value={record.updatedAt}
                />
                <Fields credential={kind === "credential"} record={record} />
                <div className="md:col-span-3 flex flex-wrap gap-2">
                  {canManage ? (
                    <SubmitButton disabled={!enabled}>Save</SubmitButton>
                  ) : null}
                  <span className="pt-2 text-sm text-[var(--text-muted)]">
                    {record.expiresOn
                      ? `Expires ${record.expiresOn}`
                      : "No expiration"}
                    {record.verifiedAt
                      ? ` · verified ${record.verifiedAt.slice(0, 10)}`
                      : ""}
                  </span>
                </div>
              </form>
              {canManage ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={actions?.[actionNames.verify]}>
                    <input name="recordId" type="hidden" value={record.id} />
                    <input
                      name="expectedUpdatedAt"
                      type="hidden"
                      value={record.updatedAt}
                    />
                    <SubmitButton disabled={!enabled}>Verify</SubmitButton>
                  </form>
                  <form action={actions?.[actionNames.renew]}>
                    <input
                      name="predecessorId"
                      type="hidden"
                      value={record.id}
                    />
                    <input name="employeeId" type="hidden" value={employeeId} />
                    <input name="type" type="hidden" value={record.type} />
                    <input
                      name="identifier"
                      type="hidden"
                      value={record.identifier}
                    />
                    <input
                      name="issuingAuthority"
                      type="hidden"
                      value={record.issuingAuthority}
                    />
                    <input
                      name="issuedOn"
                      type="hidden"
                      value={new Date().toISOString().slice(0, 10)}
                    />
                    <input
                      name="expiresOn"
                      type="hidden"
                      value={record.expiresOn}
                    />
                    <input
                      name="status"
                      type="hidden"
                      value="pending_verification"
                    />
                    <input
                      name="documentReference"
                      type="hidden"
                      value={record.documentReference}
                    />
                    <SubmitButton disabled={!enabled}>
                      Create renewal
                    </SubmitButton>
                  </form>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export function ComplianceAdmin({
  state,
  actions,
}: {
  state: ComplianceAdminPageState;
  actions?: ComplianceAdminActions;
}) {
  if (state.kind === "loading")
    return (
      <main aria-busy="true" className="p-6" role="status">
        Loading compliance…
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
          <h1 className="text-xl font-semibold">Compliance unavailable</h1>
          <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
        </section>
      </main>
    );
  return (
    <div className="grid gap-6">
      <section className={panel}>
        <h1 className="text-2xl font-semibold">
          Credentials and certifications
        </h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Compliance records preserve historical issuance. Expiration affects
          future eligibility; it never rewrites completed work.
        </p>
        {state.employees.length === 0 ? (
          <p className="mt-4 text-[var(--text-muted)]">
            No employees are available in your authorized scope.
          </p>
        ) : (
          <nav className="mt-4 grid gap-2">
            {state.employees.map((employee) => (
              <Link
                className="rounded-lg border border-white/10 p-3 hover:border-[var(--accent)]"
                href={`/admin/compliance?employee=${encodeURIComponent(employee.id)}`}
                key={employee.id}
              >
                <strong>{employee.displayName}</strong>
                <span className="ml-2 text-sm text-[var(--text-muted)]">
                  {employee.employeeNumber} · {employee.branchName} ·{" "}
                  {employee.employmentStatus}
                </span>
              </Link>
            ))}
          </nav>
        )}
      </section>
      {state.detail ? (
        <>
          <Records
            actions={actions}
            canManage={state.canManage}
            employeeId={state.detail.employee.id}
            kind="credential"
            records={state.detail.credentials}
            title="Credentials"
          />
          <Records
            actions={actions}
            canManage={state.canManage}
            employeeId={state.detail.employee.id}
            kind="certification"
            records={state.detail.certifications}
            title="Certifications"
          />
        </>
      ) : null}
    </div>
  );
}
