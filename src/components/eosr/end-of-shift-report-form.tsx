"use client";
import { useState } from "react";
import type { ActivityAssignment } from "@/features/reporting/contracts";
import type { IncomingPassdown } from "@/features/eosr/contracts";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2";
export function EndOfShiftReportForm({
  assignments,
  passdowns = [],
  submit,
}: {
  assignments: readonly ActivityAssignment[];
  passdowns?: readonly IncomingPassdown[];
  submit: (form: FormData) => Promise<unknown>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [key] = useState(() => crypto.randomUUID?.() ?? `eosr-${Date.now()}`);
  if (!assignments.length)
    return (
      <section className="rounded-xl border border-white/10 bg-[var(--card)] p-5">
        <h1 className="text-xl font-semibold">End-of-shift report</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          No authorized active assignment is available.
        </p>
      </section>
    );
  async function onSubmit(form: FormData) {
    if (busy) return;
    setBusy(true);
    setMessage("Submitting end-of-shift report…");
    try {
      await submit(form);
      setMessage(
        "End-of-shift report submitted. Your passdown is available to the incoming Guard.",
      );
    } catch {
      setMessage(
        "Your report was not submitted. Review the required shift summary and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4">
      {passdowns
        .filter((item) => !item.dismissed)
        .map((item) => (
          <section
            key={item.id}
            className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-4"
          >
            <p className="font-semibold">
              Incoming passdown · {item.siteName} / {item.postName}
            </p>
            <p className="mt-2 text-sm">{item.summary}</p>
            {item.unresolvedIssues.length ? (
              <p className="mt-2 text-sm">
                Unresolved: {item.unresolvedIssues.join(" · ")}
              </p>
            ) : null}
          </section>
        ))}
      <form
        action={onSubmit}
        className="grid gap-4 rounded-xl border border-white/10 bg-[var(--card)] p-5"
      >
        <div>
          <p className="text-sm text-[var(--text-muted)]">Shift close</p>
          <h1 className="text-2xl font-semibold">End-of-shift report</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Submit one canonical close report. Passdown is included below; no
            separate new Handoff is required.
          </p>
        </div>
        <label>
          Assignment
          <select className={input} name="shiftAssignmentId">
            {assignments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.siteName} · {item.postName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Shift summary
          <textarea
            className={input}
            name="summary"
            required
            minLength={3}
            rows={4}
          />
        </label>
        <fieldset className="grid gap-3 rounded-lg border border-white/10 p-4">
          <legend className="px-1 font-medium">
            Passdown for the incoming Guard
          </legend>
          <label>
            Unresolved issues
            <textarea
              className={input}
              name="unresolvedIssues"
              rows={3}
              placeholder="One item per line"
            />
          </label>
          <label>
            Equipment or access status
            <textarea className={input} name="equipmentAccessStatus" rows={2} />
          </label>
          <label>
            Follow-up items
            <textarea
              className={input}
              name="followUpItems"
              rows={3}
              placeholder="One item per line"
            />
          </label>
          <label>
            Unusual conditions
            <textarea className={input} name="unusualConditions" rows={2} />
          </label>
        </fieldset>
        <input type="hidden" name="submissionKey" value={key} />
        <button
          className="rounded-lg bg-white px-4 py-3 font-medium text-black disabled:opacity-60"
          disabled={busy}
        >
          {busy ? "Submitting…" : "Submit end-of-shift report"}
        </button>
        {message ? <p role="status">{message}</p> : null}
      </form>
    </div>
  );
}
