"use client";
import { useState } from "react";
import type {
  ActivityEntrySummary,
  ReportingPageState,
} from "@/features/reporting/contracts";
import { incidentGateMessage } from "@/features/reporting/incident-gate";
const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2";
export function ReportingWorkspace({
  state,
  actions,
}: {
  state: ReportingPageState;
  actions?: { createActivity(form: FormData): Promise<ActivityEntrySummary> };
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "activity-entry",
  );
  if (state.kind !== "ready")
    return (
      <section className={panel} role="alert">
        <h1 className="text-xl font-semibold">Reporting unavailable</h1>
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
      </section>
    );
  async function submit(form: FormData) {
    if (!actions || submitting) return;
    setSubmitting(true);
    setMessage("Submitting activity…");
    try {
      const entry = await actions.createActivity(form);
      setMessage(
        `Activity recorded. ${incidentGateMessage(entry.incidentGate)}`,
      );
    } catch {
      setMessage(
        "Your activity was not submitted. Review the entry and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="grid gap-6">
      <section className={panel}>
        <h1 className="text-2xl font-semibold">Shift activity</h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Record routine activity for your assigned site. Site, post, and
          assignment are confirmed by Nexus.
        </p>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Record activity</h2>
        {state.assignments.length ? (
          <form action={submit} className="mt-3 grid gap-3">
            <label>
              <span className="text-sm">Current assignment</span>
              <select className={input} name="shiftAssignmentId" required>
                {state.assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.siteName} — {a.postName}
                  </option>
                ))}
              </select>
            </label>
            <input name="submissionKey" type="hidden" value={submissionKey} />
            <label>
              <span className="text-sm">Activity type</span>
              <select className={input} name="category">
                <option value="OBSERVATION">Observation</option>
                <option value="ACCESS_CONTROL">Access control</option>
                <option value="SAFETY_CHECK">Safety check</option>
                <option value="SAFETY_CONCERN">Safety concern</option>
                <option value="REPORTABLE_INCIDENT">Reportable incident</option>
                <option value="CUSTOMER_SERVICE">Customer service</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              <span className="text-sm">What happened</span>
              <textarea className={input} name="narrative" required rows={4} />
            </label>
            <label>
              <span className="text-sm">Location or context (optional)</span>
              <input className={input} name="locationContext" />
            </label>
            <label>
              <span className="text-sm">Action taken (optional)</span>
              <input className={input} name="actionTaken" />
            </label>
            <label className="flex items-center gap-2">
              <input name="followUpRequired" type="checkbox" /> Follow-up is
              required
            </label>
            <input name="visibility" type="hidden" value="INTERNAL" />
            <button
              className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Recording…" : "Record activity"}
            </button>
            <p aria-live="polite" className="text-sm text-[var(--text-muted)]">
              {message}
            </p>
          </form>
        ) : (
          <p className="mt-3 text-[var(--text-muted)]">
            No active assignment is available for activity reporting.
          </p>
        )}
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Recent activity</h2>
        {state.recent.length ? (
          <div className="mt-3 grid gap-3">
            {state.recent.map((entry) => (
              <article
                className="rounded-lg border border-white/10 p-3"
                key={entry.id}
              >
                <strong>{entry.category.replaceAll("_", " ")}</strong>
                <p className="text-sm text-[var(--text-muted)]">
                  {entry.siteName} — {entry.postName} ·{" "}
                  {new Date(entry.occurredAt).toLocaleString()}
                </p>
                <p className="mt-1">{entry.narrative}</p>
                {entry.followUpRequired ? (
                  <p className="mt-1 text-sm">Follow-up required</p>
                ) : null}
                {entry.incidentGate !== "ROUTINE" ? (
                  <p className="mt-1 text-sm">
                    {incidentGateMessage(entry.incidentGate)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[var(--text-muted)]">
            No activity has been recorded for your assignments.
          </p>
        )}
      </section>
    </div>
  );
}
