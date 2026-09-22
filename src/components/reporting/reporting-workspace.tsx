"use client";

import { useState } from "react";
import { ActivityEntryForm } from "@/components/reporting/activity-entry-form";
import { ShiftReportTimeline } from "@/components/reporting/shift-report-timeline";
import { EndOfShiftReportForm } from "@/components/eosr/end-of-shift-report-form";
import type { IncomingPassdown } from "@/features/eosr/contracts";
import type {
  ActivityEntrySummary,
  CreateActivityResult,
  IncidentReportSummary,
  IncidentParticipantType,
  ReportingPageState,
} from "@/features/reporting/contracts";

type ParticipantDraft = {
  type: IncidentParticipantType;
  identityState: "IDENTIFIED" | "UNIDENTIFIED" | "DECLINED_TO_IDENTIFY";
  displayName: string;
  descriptiveIdentifier: string;
  involvementSummary: string;
  relationshipLabel: string;
  agencyName: string;
};
const newParticipant = (): ParticipantDraft => ({
  type: "SUBJECT",
  identityState: "UNIDENTIFIED",
  displayName: "",
  descriptiveIdentifier: "",
  involvementSummary: "",
  relationshipLabel: "",
  agencyName: "",
});

const panel = "rounded-2xl border border-white/10 bg-[var(--card)] p-4 md:p-6";
const input =
  "mt-1.5 min-h-12 w-full rounded-xl border border-white/15 bg-[var(--background)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/35";

function formatWindow(start: string, end: string) {
  const format = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${format.format(new Date(start))}–${format.format(new Date(end))}`;
}

function newIncidentSubmissionKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `incident-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ReportingWorkspace({
  state,
  actions,
  passdowns = [],
}: {
  state: ReportingPageState;
  actions?: {
    createActivity(form: FormData): Promise<CreateActivityResult>;
    createIncident(form: FormData): Promise<IncidentReportSummary>;
    submitCloseout?(form: FormData): Promise<unknown>;
    setPassdownDismissal?(form: FormData): Promise<void>;
  };
  passdowns?: readonly IncomingPassdown[];
}) {
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [timeline, setTimeline] = useState<readonly ActivityEntrySummary[]>(
    state.kind === "ready" ? state.recent : [],
  );
  const [incidents, setIncidents] = useState<readonly IncidentReportSummary[]>(
    state.kind === "ready" ? state.incidents : [],
  );
  const [relatedActivityId, setRelatedActivityId] = useState("");
  const [incidentSubmissionKey, setIncidentSubmissionKey] = useState(
    newIncidentSubmissionKey,
  );
  const [incidentMessage, setIncidentMessage] = useState("");
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    newParticipant(),
  ]);

  if (state.kind !== "ready")
    return (
      <section className={`${panel} mx-auto max-w-2xl`} role="alert">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Shift Report
        </p>
        <h1 className="mt-2 text-2xl font-bold">Shift Report unavailable</h1>
        <p className="mt-3 leading-6 text-[var(--text-muted)]">
          {state.message}
        </p>
        {state.kind === "error" && state.retryable ? (
          <a
            className="mt-5 inline-flex min-h-12 items-center rounded-xl border border-white/15 px-4 font-bold"
            href="/reporting"
          >
            Try again
          </a>
        ) : null}
      </section>
    );

  if (state.reviewEnabled)
    return (
      <section className={`${panel} mx-auto max-w-2xl`}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Reporting operations
        </p>
        <h1 className="mt-2 text-2xl font-bold">
          Supervisor / operations review
        </h1>
        <p className="mt-3 leading-6 text-[var(--text-muted)]">
          Reporting authoring is the Guard workspace. Review and amendment work
          remains in the authorized Operations Center.
        </p>
        <a
          className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[var(--accent)] px-4 font-bold text-white"
          href="/operations"
        >
          Open Operations Center
        </a>
      </section>
    );

  const assignment = state.assignments[0];
  if (!assignment)
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Shift Report
        </p>
        <h1 className="mt-2 text-3xl font-bold">Your Shift Report</h1>
        <section className={`${panel} mt-6 text-center`}>
          <h2 className="text-xl font-bold">No active assignment</h2>
          <p className="mx-auto mt-2 max-w-lg leading-6 text-[var(--text-muted)]">
            A Shift Report becomes available when your authorized assignment is
            active. Check your schedule for the next assigned site and post.
          </p>
          <a
            className="mt-5 inline-flex min-h-12 items-center rounded-xl border border-white/15 px-4 font-bold"
            href="/schedule"
          >
            View schedule
          </a>
        </section>
      </div>
    );

  const linkedIncidentCount = incidents.filter(
    (incident) => incident.originatingActivityEntryId,
  ).length;

  function fileIncident(activityEntryId = "") {
    setRelatedActivityId(activityEntryId);
    requestAnimationFrame(() => {
      document.getElementById("incident")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      document.getElementById("incident-classification")?.focus();
    });
  }

  async function submitIncident(formData: FormData) {
    if (!actions?.createIncident || submittingIncident) return;
    setSubmittingIncident(true);
    setIncidentMessage("Submitting Security Incident Report…");
    try {
      const incident = await actions.createIncident(formData);
      setIncidents((current) => [incident, ...current]);
      setIncidentSubmissionKey(newIncidentSubmissionKey());
      setParticipants([newParticipant()]);
      setIncidentMessage(
        `Security Incident ${incident.incidentNumber} confirmed.`,
      );
    } catch {
      setIncidentMessage(
        "The Security Incident Report was not confirmed. Review the information before retrying.",
      );
    } finally {
      setSubmittingIncident(false);
    }
  }

  return (
    <div className="grid gap-5 pb-4 md:gap-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
              Shift Report
            </p>
            <h1 className="mt-1 text-3xl font-bold">
              Your active Shift Report
            </h1>
          </div>
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-100">
            Active now
          </span>
        </div>
      </header>

      <section className={panel} aria-label="Active assignment context">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--text-muted)]">
              Current assignment
            </p>
            <h2 className="mt-1 text-xl font-bold">{assignment.siteName}</h2>
            <p className="mt-1 text-[var(--text-muted)]">
              {assignment.postName} ·{" "}
              {formatWindow(assignment.scheduledStart, assignment.scheduledEnd)}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="text-[var(--text-muted)]">Activity entries</dt>
              <dd className="mt-1 text-lg font-bold">{timeline.length}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Linked incidents</dt>
              <dd className="mt-1 text-lg font-bold">{linkedIncidentCount}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button
            className="min-h-12 rounded-xl bg-[var(--accent)] px-4 font-bold text-white shadow-lg shadow-black/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => setActivityFormOpen(true)}
            type="button"
          >
            + Add activity
          </button>
          <button
            className="min-h-12 rounded-xl border border-white/15 px-4 font-bold hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={() => fileIncident()}
            type="button"
          >
            File Security Incident
          </button>
          <a
            className="flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-4 text-center font-bold hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            href="#shift-closeout"
          >
            Closeout Shift Report
          </a>
        </div>
      </section>

      {actions?.createActivity ? (
        <ActivityEntryForm
          assignment={assignment}
          createActivity={actions.createActivity}
          hidden={!activityFormOpen}
          onCancel={() => setActivityFormOpen(false)}
          onConfirmed={(entry) => {
            setTimeline((current) =>
              [...current, entry].toSorted((left, right) =>
                left.occurredAt === right.occurredAt
                  ? left.id.localeCompare(right.id)
                  : left.occurredAt.localeCompare(right.occurredAt),
              ),
            );
          }}
        />
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <ShiftReportTimeline
          entries={timeline}
          hasMore={Boolean(state.timelineHasMore)}
          incidents={incidents}
          onFileIncident={fileIncident}
        />

        <aside className="grid min-w-0 gap-5">
          <section className={panel} id="shift-closeout">
            <h2 className="text-lg font-bold">Shift closeout</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Review this timeline before completing the closeout and passdown.
              The activity narrative is already part of your Shift Report.
            </p>
            {actions?.submitCloseout && actions.setPassdownDismissal ? (
              <div className="mt-4">
                <EndOfShiftReportForm
                  assignments={[assignment]}
                  embedded
                  passdowns={passdowns}
                  setPassdownDismissal={actions.setPassdownDismissal}
                  submit={actions.submitCloseout}
                />
              </div>
            ) : null}
          </section>

          <section className={panel} id="incident">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-red-200">
              Separate formal workflow
            </p>
            <h2 className="mt-2 text-xl font-bold">Security Incident Report</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              File a formal report for a security, safety, access, or property
              event. Nexus preserves any originating activity link.
            </p>
            {actions?.createIncident ? (
              <form action={submitIncident} className="mt-5 grid gap-4">
                <input
                  name="shiftAssignmentId"
                  type="hidden"
                  value={assignment.id}
                />
                <input
                  name="submissionKey"
                  type="hidden"
                  value={incidentSubmissionKey}
                />
                <input name="visibility" type="hidden" value="INTERNAL" />
                <input
                  name="participants"
                  type="hidden"
                  value={JSON.stringify(participants)}
                />
                <label className="font-semibold">
                  Related activity{" "}
                  <span className="font-normal text-[var(--text-muted)]">
                    (optional)
                  </span>
                  <select
                    className={input}
                    name="originatingActivityEntryId"
                    onChange={(event) =>
                      setRelatedActivityId(event.target.value)
                    }
                    value={relatedActivityId}
                  >
                    <option value="">No related activity</option>
                    {timeline.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.category.replaceAll("_", " ")} ·{" "}
                        {entry.narrative}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="font-semibold">
                  Classification
                  <select
                    className={input}
                    id="incident-classification"
                    name="classification"
                    required
                  >
                    <option value="SECURITY">Security</option>
                    <option value="SAFETY">Safety</option>
                    <option value="ACCESS">Access</option>
                    <option value="PROPERTY">Property</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="font-semibold">
                  Severity
                  <select className={input} name="severity" required>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </label>
                <label className="font-semibold">
                  What happened
                  <textarea
                    className={`${input} min-h-28`}
                    name="narrative"
                    required
                    rows={4}
                  />
                </label>
                <label className="font-semibold">
                  Immediate actions taken
                  <textarea
                    className={`${input} min-h-24`}
                    name="actionsTaken"
                    required
                    rows={3}
                  />
                </label>
                <fieldset className="grid gap-3 rounded-xl border border-white/10 p-3">
                  <legend className="px-1 font-semibold">Participants</legend>
                  <p className="text-sm text-[var(--text-muted)]">
                    Add at least one involved person, witness, agency, or other
                    relevant participant. Do not enter unnecessary sensitive
                    information.
                  </p>
                  {participants.map((participant, index) => (
                    <div
                      className="grid gap-3 rounded-xl border border-white/10 p-3"
                      key={index}
                    >
                      <label className="font-semibold">
                        Participant type
                        <select
                          aria-label={`Participant ${index + 1} type`}
                          className={input}
                          value={participant.type}
                          onChange={(event) =>
                            setParticipants((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...newParticipant(),
                                      type: event.target
                                        .value as IncidentParticipantType,
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="SUBJECT">Subject</option>
                          <option value="WITNESS">Witness</option>
                          <option value="AGENCY">Agency</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </label>
                      {participant.type === "AGENCY" ? (
                        <label className="font-semibold">
                          Agency name
                          <input
                            className={input}
                            required
                            value={participant.agencyName}
                            onChange={(event) =>
                              setParticipants((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        agencyName: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                      ) : (
                        <>
                          <label className="font-semibold">
                            Identity state
                            <select
                              className={input}
                              value={participant.identityState}
                              onChange={(event) =>
                                setParticipants((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          identityState: event.target
                                            .value as ParticipantDraft["identityState"],
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <option value="IDENTIFIED">Identified</option>
                              <option value="UNIDENTIFIED">Unidentified</option>
                              <option value="DECLINED_TO_IDENTIFY">
                                Declined to identify
                              </option>
                            </select>
                          </label>
                          <label className="font-semibold">
                            {participant.identityState === "IDENTIFIED"
                              ? "Display name"
                              : "Descriptive identifier"}
                            <input
                              className={input}
                              required
                              value={
                                participant.identityState === "IDENTIFIED"
                                  ? participant.displayName
                                  : participant.descriptiveIdentifier
                              }
                              onChange={(event) =>
                                setParticipants((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? participant.identityState ===
                                        "IDENTIFIED"
                                        ? {
                                            ...item,
                                            displayName: event.target.value,
                                          }
                                        : {
                                            ...item,
                                            descriptiveIdentifier:
                                              event.target.value,
                                          }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </label>
                        </>
                      )}
                      {participant.type === "OTHER" ? (
                        <label className="font-semibold">
                          Relationship label
                          <input
                            className={input}
                            required
                            value={participant.relationshipLabel}
                            onChange={(event) =>
                              setParticipants((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        relationshipLabel: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                      ) : null}
                      <label className="font-semibold">
                        Involvement summary
                        <textarea
                          className={`${input} min-h-20`}
                          required
                          value={participant.involvementSummary}
                          onChange={(event) =>
                            setParticipants((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      involvementSummary: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        className="min-h-12 justify-self-start rounded-xl border border-white/15 px-3 font-semibold disabled:opacity-50"
                        disabled={participants.length === 1}
                        type="button"
                        onClick={() =>
                          setParticipants((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        Remove participant
                      </button>
                    </div>
                  ))}
                  <button
                    className="min-h-12 justify-self-start rounded-xl border border-white/15 px-3 font-semibold"
                    type="button"
                    onClick={() =>
                      setParticipants((current) => [
                        ...current,
                        newParticipant(),
                      ])
                    }
                  >
                    Add participant
                  </button>
                </fieldset>
                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 px-3 font-semibold">
                  <input
                    className="h-5 w-5"
                    name="emergencyServiceInvolvement"
                    type="checkbox"
                  />
                  Emergency services involved
                </label>
                <button
                  className="min-h-12 rounded-xl border border-red-400/40 bg-red-400/10 px-4 font-bold text-red-50 disabled:opacity-60"
                  disabled={submittingIncident}
                  type="submit"
                >
                  {submittingIncident
                    ? "Submitting incident…"
                    : "Submit Security Incident"}
                </button>
                <p
                  aria-live="polite"
                  className="text-sm text-[var(--text-muted)]"
                  role="status"
                >
                  {incidentMessage}
                </p>
              </form>
            ) : null}
          </section>

          {incidents.length ? (
            <section className={panel} aria-labelledby="incidents-heading">
              <h2 className="text-lg font-bold" id="incidents-heading">
                Security Incidents
              </h2>
              <div className="mt-4 grid gap-3">
                {incidents.map((incident) => (
                  <article
                    className="scroll-mt-4 rounded-xl border border-red-400/25 bg-red-400/[0.05] p-3"
                    id={`incident-${incident.id}`}
                    key={incident.id}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>{incident.incidentNumber}</strong>
                      <span className="text-xs font-bold text-red-100">
                        {incident.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {incident.classification} ·{" "}
                      {incident.originatingActivityEntryId
                        ? "Linked to activity"
                        : "Formal incident"}
                    </p>
                    <p className="mt-2 break-words text-sm leading-5">
                      {incident.narrative}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
