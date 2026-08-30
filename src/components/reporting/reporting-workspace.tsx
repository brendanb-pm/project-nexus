"use client";
import { useState } from "react";
import type {
  ActivityEntrySummary,
  HandoffSummary,
  IncidentReportSummary,
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
  actions?: {
    createActivity(form: FormData): Promise<ActivityEntrySummary>;
    createIncident(form: FormData): Promise<IncidentReportSummary>;
    createHandoff(form: FormData): Promise<HandoffSummary>;
  };
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [submittingHandoff, setSubmittingHandoff] = useState(false);
  const [submissionKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "activity-entry",
  );
  const [incidentSubmissionKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "incident-report",
  );
  const [handoffSubmissionKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "handoff",
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
  async function submitIncident(form: FormData) {
    if (!actions || submittingIncident) return;
    setSubmittingIncident(true);
    setMessage("Submitting incident report…");
    try {
      const incident = await actions.createIncident(form);
      setMessage(`Incident ${incident.incidentNumber} submitted.`);
    } catch {
      setMessage(
        "Your incident was not submitted. Review the report and try again.",
      );
    } finally {
      setSubmittingIncident(false);
    }
  }
  async function submitHandoff(form: FormData) {
    if (!actions || submittingHandoff) return;
    setSubmittingHandoff(true);
    setMessage("Submitting handoff…");
    try {
      await actions.createHandoff(form);
      setMessage("Handoff submitted for the next shift.");
    } catch {
      setMessage("Your handoff was not submitted. Review it and try again.");
    } finally {
      setSubmittingHandoff(false);
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
        <h2 className="text-xl font-semibold">End-of-shift handoff</h2>
        <p className="mt-1 text-[var(--text-muted)]">
          Leave the next guard and supervisor an accurate record of unresolved
          issues, equipment or key status, and follow-up work.
        </p>
        {state.assignments.length ? (
          <form action={submitHandoff} className="mt-3 grid gap-3">
            <label>
              <span className="text-sm">Current assignment</span>
              <select className={input} name="shiftAssignmentId" required>
                {state.assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.siteName} — {assignment.postName}
                  </option>
                ))}
              </select>
            </label>
            <input
              name="submissionKey"
              type="hidden"
              value={handoffSubmissionKey}
            />
            <input name="visibility" type="hidden" value="INTERNAL" />
            <label>
              <span className="text-sm">Unresolved issues (one per line)</span>
              <textarea className={input} name="unresolvedIssues" rows={3} />
            </label>
            <label>
              <span className="text-sm">Equipment and key status</span>
              <textarea className={input} name="equipmentKeyStatus" rows={3} />
            </label>
            <label>
              <span className="text-sm">Follow-up items (one per line)</span>
              <textarea className={input} name="followUpItems" rows={3} />
            </label>
            <button
              className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-60"
              disabled={submittingHandoff}
              type="submit"
            >
              {submittingHandoff ? "Submitting…" : "Submit handoff"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-[var(--text-muted)]">
            An active assignment is required to submit a handoff.
          </p>
        )}
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
        <h2 className="text-xl font-semibold">Submitted handoffs</h2>
        {state.handoffs.length ? (
          <div className="mt-3 grid gap-3">
            {state.handoffs.map((handoff) => (
              <article
                className="rounded-lg border border-white/10 p-3"
                key={handoff.id}
              >
                <strong>
                  {handoff.siteName} — {handoff.postName}
                </strong>
                <p className="text-sm text-[var(--text-muted)]">
                  Submitted {new Date(handoff.submittedAt).toLocaleString()}
                </p>
                {handoff.unresolvedIssues.length ? (
                  <p className="mt-1">
                    Unresolved: {handoff.unresolvedIssues.join("; ")}
                  </p>
                ) : null}
                {handoff.equipmentKeyStatus ? (
                  <p className="mt-1">
                    Equipment/keys: {handoff.equipmentKeyStatus}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[var(--text-muted)]">
            No handoffs have been submitted for your assignments.
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
      <section className={panel}>
        <h2 className="text-xl font-semibold">Report an incident</h2>
        <p className="mt-1 text-[var(--text-muted)]">
          Submit a factual report for a security, safety, access, or property
          event. Nexus confirms the assignment, site, and post.
        </p>
        {state.assignments.length ? (
          <form action={submitIncident} className="mt-3 grid gap-3">
            <label>
              <span className="text-sm">Current assignment</span>
              <select className={input} name="shiftAssignmentId" required>
                {state.assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.siteName} — {assignment.postName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm">Related activity (optional)</span>
              <select className={input} name="originatingActivityEntryId">
                <option value="">No related activity</option>
                {state.recent.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.category.replaceAll("_", " ")} — {entry.narrative}
                  </option>
                ))}
              </select>
            </label>
            <input
              name="submissionKey"
              type="hidden"
              value={incidentSubmissionKey}
            />
            <input name="visibility" type="hidden" value="INTERNAL" />
            <label>
              <span className="text-sm">Classification</span>
              <select className={input} name="classification" required>
                <option value="SECURITY">Security</option>
                <option value="SAFETY">Safety</option>
                <option value="ACCESS">Access</option>
                <option value="PROPERTY">Property</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              <span className="text-sm">Severity</span>
              <select className={input} name="severity" required>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
            <label>
              <span className="text-sm">What happened</span>
              <textarea className={input} name="narrative" required rows={5} />
            </label>
            <label>
              <span className="text-sm">Immediate actions taken</span>
              <textarea
                className={input}
                name="actionsTaken"
                required
                rows={3}
              />
            </label>
            <label>
              <span className="text-sm">External report number (optional)</span>
              <input className={input} name="externalReportNumber" />
            </label>
            <label className="flex items-center gap-2">
              <input name="emergencyServiceInvolvement" type="checkbox" />
              Emergency services were involved
            </label>
            <button
              className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-60"
              disabled={submittingIncident}
              type="submit"
            >
              {submittingIncident ? "Submitting…" : "Submit incident report"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-[var(--text-muted)]">
            An active assignment is required to submit an incident report.
          </p>
        )}
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Recent incidents</h2>
        {state.incidents.length ? (
          <div className="mt-3 grid gap-3">
            {state.incidents.map((incident) => (
              <article
                className="rounded-lg border border-white/10 p-3"
                key={incident.id}
              >
                <strong>{incident.incidentNumber}</strong>
                <p className="text-sm text-[var(--text-muted)]">
                  {incident.classification.replaceAll("_", " ")} ·{" "}
                  {incident.severity}
                  {" · "}
                  {new Date(incident.occurredAt).toLocaleString()}
                </p>
                <p className="mt-1">{incident.narrative}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[var(--text-muted)]">
            No incident reports have been submitted for your assignments.
          </p>
        )}
      </section>
    </div>
  );
}
