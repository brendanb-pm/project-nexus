"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  activityCategories,
  type ActivityAssignment,
  type ActivityEntrySummary,
  type CreateActivityResult,
} from "@/features/reporting/contracts";
import {
  ReportingDraftControls,
  useReportingDraft,
} from "./use-reporting-draft";

const input =
  "mt-1.5 min-h-12 w-full rounded-xl border border-white/15 bg-[var(--background)] px-3 py-2 text-base outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/35";

const categoryLabels = {
  OBSERVATION: "Observation",
  ACCESS_CONTROL: "Access control",
  SAFETY_CHECK: "Safety check",
  SAFETY_CONCERN: "Safety concern",
  REPORTABLE_INCIDENT: "Reportable incident",
  CUSTOMER_SERVICE: "Customer service",
  OTHER: "Other",
} as const;

function newSubmissionKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type SubmissionState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "confirmed" }
  | {
      kind: "validation-error";
      fieldErrors: Readonly<Record<string, readonly string[]>>;
    }
  | { kind: "failed"; message: string }
  | { kind: "confirmation-unknown" };

export function ActivityEntryForm({
  assignment,
  hidden,
  createActivity,
  draftEnabled = false,
  onCancel,
  onConfirmed,
}: {
  assignment: ActivityAssignment;
  hidden: boolean;
  createActivity(form: FormData): Promise<CreateActivityResult>;
  draftEnabled?: boolean;
  onCancel(): void;
  onConfirmed(entry: ActivityEntrySummary): void;
}) {
  const [submissionKey, setSubmissionKey] = useState(newSubmissionKey);
  const [submission, setSubmission] = useState<SubmissionState>({
    kind: "idle",
  });
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!hidden) requestAnimationFrame(() => headingRef.current?.focus());
  }, [hidden]);
  useEffect(() => {
    if (
      ["validation-error", "failed", "confirmation-unknown"].includes(
        submission.kind,
      )
    ) {
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
  }, [submission.kind]);
  const draft = useReportingDraft({
    enabled: draftEnabled,
    assignmentId: assignment.id,
    family: "SHIFT_ACTIVITY",
    readPayload: () => {
      const form = formRef.current;
      const data = form ? new FormData(form) : new FormData();
      return {
        category: String(data.get("category") ?? "OBSERVATION"),
        narrative: String(data.get("narrative") ?? ""),
        locationContext: String(data.get("locationContext") ?? ""),
        actionTaken: String(data.get("actionTaken") ?? ""),
        followUpRequired: data.has("followUpRequired"),
        visibility: "INTERNAL",
      };
    },
    restorePayload: (payload) => {
      const form = formRef.current;
      if (!form) return;
      for (const name of [
        "category",
        "narrative",
        "locationContext",
        "actionTaken",
      ]) {
        const field = form.elements.namedItem(name);
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement
        )
          field.value = typeof payload[name] === "string" ? payload[name] : "";
      }
      const followUp = form.elements.namedItem("followUpRequired");
      if (followUp instanceof HTMLInputElement)
        followUp.checked = payload.followUpRequired === true;
    },
    clearPayload: () => formRef.current?.reset(),
  });

  const fieldError = (name: string) =>
    submission.kind === "validation-error"
      ? submission.fieldErrors[name]?.[0]
      : undefined;

  async function submit(formData: FormData) {
    if (submission.kind === "submitting") return;
    setSubmission({ kind: "submitting" });
    try {
      if (draftEnabled) {
        const result = await draft.submit();
        if (result.kind === "submitted" && result.family === "SHIFT_ACTIVITY") {
          onConfirmed(result.record as ActivityEntrySummary);
          formRef.current?.reset();
          setSubmission({ kind: "confirmed" });
        } else if (result.kind === "already-submitted") {
          window.location.reload();
        } else if (result.kind === "validation-error") {
          setSubmission({
            kind: "validation-error",
            fieldErrors: result.fieldErrors,
          });
        } else {
          setSubmission({
            kind: "failed",
            message:
              draft.message ||
              "Draft submission needs attention. Review the draft status below.",
          });
        }
        return;
      }
      const result = await createActivity(formData);
      if (result.kind === "validation-error") {
        setSubmission(result);
        requestAnimationFrame(() => errorSummaryRef.current?.focus());
        return;
      }
      if (result.kind === "rejected") {
        setSubmission({ kind: "failed", message: result.message });
        requestAnimationFrame(() => errorSummaryRef.current?.focus());
        return;
      }
      onConfirmed(result.entry);
      formRef.current?.reset();
      setSubmissionKey(newSubmissionKey());
      setSubmission({ kind: "confirmed" });
    } catch {
      setSubmission({ kind: "confirmation-unknown" });
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(new FormData(event.currentTarget));
  }

  return (
    <section
      aria-labelledby="add-activity-heading"
      className={`${hidden ? "hidden" : "block"} rounded-2xl border border-white/10 bg-[var(--card)] p-4 shadow-xl md:p-6`}
      id="add-activity"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
            Shift Report · Activity
          </p>
          <h2
            className="mt-1 text-2xl font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            id="add-activity-heading"
            ref={headingRef}
            tabIndex={-1}
          >
            Add activity
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {assignment.siteName} · {assignment.postName}. Nexus confirms the
            assignment and occurrence time when the entry is recorded.
          </p>
        </div>
        <button
          className="min-h-12 rounded-xl border border-white/15 px-4 font-semibold hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          onClick={onCancel}
          type="button"
        >
          Close
        </button>
      </div>

      {submission.kind === "validation-error" ||
      submission.kind === "failed" ||
      submission.kind === "confirmation-unknown" ? (
        <div
          className="mt-5 rounded-xl border border-red-400/45 bg-red-400/10 p-4 text-red-50 outline-none"
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >
          <strong>
            {submission.kind === "validation-error"
              ? "Check this activity"
              : submission.kind === "confirmation-unknown"
                ? "Confirmation not received"
                : "Activity not recorded"}
          </strong>
          <p className="mt-1 text-sm leading-5">
            {submission.kind === "validation-error"
              ? "Correct the fields identified below. Your entered information is still here."
              : submission.kind === "confirmation-unknown"
                ? "Nexus could not confirm the result. Your information is preserved. Retry uses the same submission key, so it cannot create a duplicate entry."
                : submission.message}
          </p>
          {submission.kind === "validation-error" ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {Object.entries(submission.fieldErrors).map(([field, errors]) => (
                <li key={field}>
                  <a className="underline" href={`#activity-${field}`}>
                    {errors[0]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {submission.kind === "confirmed" ? (
        <p
          className="mt-5 rounded-xl border border-emerald-400/35 bg-emerald-400/10 p-4 text-sm text-emerald-100"
          role="status"
        >
          Activity confirmed and added to this Shift Report.
        </p>
      ) : null}

      <form
        className="mt-5 grid gap-5"
        onChange={draftEnabled ? draft.changed : undefined}
        onInput={draftEnabled ? draft.changed : undefined}
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <input name="shiftAssignmentId" type="hidden" value={assignment.id} />
        <input name="submissionKey" type="hidden" value={submissionKey} />
        <input name="visibility" type="hidden" value="INTERNAL" />

        <label className="font-semibold">
          Activity category
          <select
            aria-describedby={
              fieldError("category") ? "category-error" : undefined
            }
            aria-invalid={Boolean(fieldError("category"))}
            className={input}
            id="activity-category"
            name="category"
            required
          >
            {activityCategories.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </select>
          {fieldError("category") ? (
            <span
              className="mt-1 block text-sm text-red-200"
              id="category-error"
            >
              {fieldError("category")}
            </span>
          ) : null}
        </label>

        <label className="font-semibold">
          What happened
          <textarea
            aria-describedby={
              fieldError("narrative") ? "narrative-error" : undefined
            }
            aria-invalid={Boolean(fieldError("narrative"))}
            className={`${input} min-h-32`}
            id="activity-narrative"
            name="narrative"
            required
            rows={5}
          />
          {fieldError("narrative") ? (
            <span
              className="mt-1 block text-sm text-red-200"
              id="narrative-error"
            >
              {fieldError("narrative")}
            </span>
          ) : null}
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="font-semibold">
            Location or context{" "}
            <span className="font-normal text-[var(--text-muted)]">
              (optional)
            </span>
            <input className={input} name="locationContext" />
          </label>
          <label className="font-semibold">
            Action taken{" "}
            <span className="font-normal text-[var(--text-muted)]">
              (optional)
            </span>
            <input className={input} name="actionTaken" />
          </label>
        </div>

        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 px-3 font-semibold">
          <input
            className="h-5 w-5 accent-[var(--accent)]"
            name="followUpRequired"
            type="checkbox"
          />
          Follow-up is required
        </label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <button
            className="min-h-12 rounded-xl bg-[var(--accent-control)] px-5 font-bold text-white shadow-lg shadow-black/20 disabled:cursor-wait disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            disabled={
              submission.kind === "submitting" ||
              (draftEnabled &&
                [
                  "loading",
                  "recovery-available",
                  "inaccessible",
                  "conflict",
                ].includes(draft.status))
            }
            type="submit"
          >
            {submission.kind === "submitting"
              ? "Submitting activity…"
              : submission.kind === "confirmation-unknown"
                ? "Retry same submission"
                : "Save activity"}
          </button>
          <button
            className="min-h-12 rounded-xl border border-white/15 px-5 font-semibold hover:bg-white/5"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
        {draftEnabled ? <ReportingDraftControls draft={draft} /> : null}
        <p aria-live="polite" className="sr-only" role="status">
          {submission.kind === "submitting" ? "Submitting activity" : ""}
        </p>
      </form>
    </section>
  );
}
