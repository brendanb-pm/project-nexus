"use client";

import { useState, useTransition } from "react";
import type { ReportingExceptionSummary } from "@/features/reporting-exceptions/contracts";
import type { ReportingExceptionActionResult } from "@/app/operations/reporting-exceptions/actions";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-4 md:p-5";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export function ReportingExceptionQueue({
  exceptions,
  lifecycleRole,
  transition,
}: {
  exceptions: readonly ReportingExceptionSummary[];
  lifecycleRole: "FULL" | "SUPERVISOR";
  transition(form: FormData): Promise<ReportingExceptionActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [invalidId, setInvalidId] = useState<string | null>(null);
  function submit(form: HTMLFormElement) {
    if (!String(new FormData(form).get("reason") ?? "").trim()) {
      setMessage("A reason is required before updating a reporting exception.");
      setInvalidId(String(new FormData(form).get("exceptionId")));
      (form.elements.namedItem("reason") as HTMLInputElement | null)?.focus();
      return;
    }
    setInvalidId(null);
    startTransition(async () => {
      const result = await transition(new FormData(form));
      setMessage(result.message);
    });
  }
  return (
    <main className="mx-auto grid max-w-6xl gap-5 p-4 pb-8 md:p-6">
      <header className={panel}>
        <p className="text-sm text-[var(--text-muted)]">Operations</p>
        <h1 className="mt-1 text-2xl font-bold">Missing and late reports</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
          Canonical reporting obligations only. Source reports are never changed
          here.
        </p>
      </header>
      {message ? (
        <p className={panel} role="status">
          {message}
        </p>
      ) : null}
      {exceptions.length ? (
        exceptions.map((item) => (
          <section className={panel} key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  {label(item.classification)} · {label(item.obligationType)}
                </p>
                <h2 className="mt-1 text-lg font-bold">
                  Assignment reporting exception
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Due {new Date(item.dueAt).toLocaleString()} ·{" "}
                  {label(item.state)}
                </p>
              </div>
              <a
                className="min-h-11 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold"
                href={`/operations/reporting-exceptions/${item.id}`}
              >
                Review evidence and history
              </a>
            </div>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                submit(event.currentTarget);
              }}
            >
              <input name="exceptionId" type="hidden" value={item.id} />
              <input
                name="expectedRevision"
                type="hidden"
                value={item.revision}
              />
              <label className="grid gap-1 text-sm font-semibold">
                Reason for action
                <input
                  aria-label="Reason for action"
                  aria-describedby={
                    invalidId === item.id
                      ? `reason-error-${item.id}`
                      : undefined
                  }
                  aria-invalid={invalidId === item.id}
                  className="min-h-11 rounded-lg border border-white/15 bg-[var(--background)] px-3"
                  name="reason"
                  required
                />
                {invalidId === item.id ? (
                  <span className="text-red-200" id={`reason-error-${item.id}`}>
                    {message}
                  </span>
                ) : null}
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Action
                <select
                  className="min-h-11 rounded-lg border border-white/15 bg-[var(--background)] px-3"
                  name="nextState"
                  defaultValue="ACKNOWLEDGED"
                >
                  <option value="ACKNOWLEDGED">Acknowledge</option>
                  <option value="CORRECTION_REQUESTED">
                    Request correction
                  </option>
                  <option value="RESOLVED">Resolve corrected report</option>
                  {lifecycleRole === "FULL" ? (
                    <option value="ESCALATED">Escalate</option>
                  ) : null}
                  {lifecycleRole === "FULL" ? (
                    <option value="WAIVED">Waive</option>
                  ) : null}
                </select>
              </label>
              <button
                className="min-h-11 rounded-lg bg-[var(--accent-control)] px-4 font-bold text-white disabled:opacity-60"
                disabled={pending}
                type="submit"
              >
                {pending ? "Updating…" : "Update"}
              </button>
            </form>
          </section>
        ))
      ) : (
        <section className={panel}>
          <h2 className="font-bold">No reporting exceptions</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            No late or missing reporting obligations are currently in your
            authorized scope.
          </p>
        </section>
      )}
    </main>
  );
}
