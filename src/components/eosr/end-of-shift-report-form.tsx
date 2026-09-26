"use client";
import { useRef, useState } from "react";
import {
  ReportingDraftControls,
  useReportingDraft,
} from "@/components/reporting/use-reporting-draft";
import type { ActivityAssignment } from "@/features/reporting/contracts";
import type { IncomingPassdown } from "@/features/eosr/contracts";
import { IncomingPassdownCards } from "./incoming-passdown-cards";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2";
export function EndOfShiftReportForm({
  assignments,
  passdowns = [],
  submit,
  setPassdownDismissal,
  embedded = false,
  draftEnabled = false,
}: {
  assignments: readonly ActivityAssignment[];
  passdowns?: readonly IncomingPassdown[];
  submit: (form: FormData) => Promise<unknown>;
  setPassdownDismissal: (form: FormData) => Promise<void>;
  /** When rendered in Shift Report, EOSR is its closeout section, not a route-level product. */
  embedded?: boolean;
  draftEnabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, boolean>>({});
  const [key] = useState(() => crypto.randomUUID?.() ?? `eosr-${Date.now()}`);
  const formRef = useRef<HTMLFormElement>(null);
  const draft = useReportingDraft({
    enabled: draftEnabled && Boolean(assignments[0]),
    assignmentId: assignments[0]?.id ?? "",
    family: "SHIFT_CLOSEOUT",
    readPayload: () => {
      const data = formRef.current
        ? new FormData(formRef.current)
        : new FormData();
      return {
        summary: String(data.get("summary") ?? ""),
        unresolvedIssues: String(data.get("unresolvedIssues") ?? ""),
        equipmentAccessStatus: String(data.get("equipmentAccessStatus") ?? ""),
        followUpItems: String(data.get("followUpItems") ?? ""),
        unusualConditions: String(data.get("unusualConditions") ?? ""),
      };
    },
    restorePayload: (payload) => {
      const form = formRef.current;
      if (!form) return;
      for (const name of [
        "summary",
        "unresolvedIssues",
        "equipmentAccessStatus",
        "followUpItems",
        "unusualConditions",
      ]) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLTextAreaElement)
          field.value = typeof payload[name] === "string" ? payload[name] : "";
      }
      setDetails(
        Object.fromEntries(
          [
            "unresolvedIssues",
            "equipmentAccessStatus",
            "followUpItems",
            "unusualConditions",
          ].map((name) => [name, Boolean(String(payload[name] ?? "").trim())]),
        ),
      );
    },
    clearPayload: () => {
      formRef.current?.reset();
      setDetails({});
      setReviewing(false);
    },
  });
  function chooseDetail(name: string, enabled: boolean) {
    setDetails((current) => ({ ...current, [name]: enabled }));
    setReviewing(false);
    if (draftEnabled) draft.changed();
  }
  function openReview() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const data = new FormData(form);
    setReview(
      Object.fromEntries(
        [
          "summary",
          "unresolvedIssues",
          "equipmentAccessStatus",
          "followUpItems",
          "unusualConditions",
        ].map((name) => [name, String(data.get(name) ?? "").trim()]),
      ),
    );
    setMessage("");
    setReviewing(true);
  }
  async function onSubmit(form: FormData) {
    if (embedded && !reviewing) {
      openReview();
      return;
    }
    if (busy) return;
    setBusy(true);
    setMessage("Submitting end-of-shift report…");
    try {
      if (draftEnabled) {
        const result = await draft.submit();
        if (result.kind === "submitted" && result.family === "SHIFT_CLOSEOUT") {
          setMessage(
            "End-of-shift report submitted. Your passdown is available to the incoming Guard.",
          );
          setCompleted(true);
        } else if (result.kind === "already-submitted") {
          window.location.reload();
        } else {
          setMessage(
            "Your saved closeout needs attention. Review the draft status below.",
          );
        }
        return;
      }
      const result = await submit(form);
      const outcome =
        result && typeof result === "object" && "kind" in result
          ? (result as { kind?: unknown; message?: unknown })
          : { kind: "confirmed" };
      if (outcome.kind !== "confirmed") {
        setMessage(
          typeof outcome.message === "string"
            ? outcome.message
            : "Your report was not submitted. Review the required shift summary and try again.",
        );
        return;
      }
      setMessage(
        "End-of-shift report submitted. Your passdown is available to the incoming Guard.",
      );
      setCompleted(true);
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
      <IncomingPassdownCards
        passdowns={passdowns}
        setPassdownDismissal={setPassdownDismissal}
      />
      {!assignments.length ? (
        <section className="rounded-xl border border-white/10 bg-[var(--card)] p-5">
          <h2 className="text-xl font-semibold">Shift closeout unavailable</h2>
          <p className="mt-2 text-[var(--text-muted)]">
            No authorized active assignment is available.
          </p>
        </section>
      ) : completed ? (
        <section
          className="rounded-xl border border-emerald-400/35 bg-emerald-400/10 p-5"
          role="status"
        >
          <h2 className="text-xl font-semibold">Shift Report complete</h2>
          <p className="mt-2">{message}</p>
        </section>
      ) : (
        <form
          className="grid gap-4 rounded-xl border border-white/10 bg-[var(--card)] p-5"
          onChange={draftEnabled ? draft.changed : undefined}
          onInput={draftEnabled ? draft.changed : undefined}
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(new FormData(event.currentTarget));
          }}
          ref={formRef}
        >
          <div>
            <p className="text-sm text-[var(--text-muted)]">Shift close</p>
            {embedded ? (
              <h2 className="text-2xl font-semibold">Shift closeout</h2>
            ) : (
              <h1 className="text-2xl font-semibold">Shift closeout</h1>
            )}
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Submit one canonical close report. Passdown is included below; no
              separate new Handoff is required.
            </p>
          </div>
          {embedded ? (
            <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[var(--text-muted)]">
              Your activity timeline is already part of this Shift Report.
              Summarize material conditions here; do not repeat every entry.
            </p>
          ) : null}
          <div className={reviewing ? "hidden" : "grid gap-4"}>
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
              <div className="grid gap-2">
                <span className="font-medium">Unresolved issues</span>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Issue state choices"
                >
                  <button
                    aria-pressed={!details.unresolvedIssues}
                    className="min-h-11 rounded-lg border border-white/20 px-3 aria-pressed:bg-[var(--accent-control)]"
                    onClick={() => chooseDetail("unresolvedIssues", false)}
                    type="button"
                  >
                    No unresolved issues
                  </button>
                  <button
                    aria-pressed={Boolean(details.unresolvedIssues)}
                    className="min-h-11 rounded-lg border border-white/20 px-3 aria-pressed:bg-[var(--accent-control)]"
                    onClick={() => chooseDetail("unresolvedIssues", true)}
                    type="button"
                  >
                    Issues remain
                  </button>
                </div>
              </div>
              <label className={details.unresolvedIssues ? "" : "hidden"}>
                Unresolved issues
                <textarea
                  className={input}
                  disabled={!details.unresolvedIssues}
                  name="unresolvedIssues"
                  required={Boolean(details.unresolvedIssues)}
                  rows={3}
                  placeholder="One item per line"
                />
              </label>
              <div className="grid gap-2">
                <span className="font-medium">Equipment or access</span>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Equipment state choices"
                >
                  <button
                    aria-pressed={!details.equipmentAccessStatus}
                    className="min-h-11 rounded-lg border border-white/20 px-3 aria-pressed:bg-[var(--accent-control)]"
                    onClick={() => chooseDetail("equipmentAccessStatus", false)}
                    type="button"
                  >
                    All accounted for
                  </button>
                  <button
                    aria-pressed={Boolean(details.equipmentAccessStatus)}
                    className="min-h-11 rounded-lg border border-white/20 px-3 aria-pressed:bg-[var(--accent-control)]"
                    onClick={() => chooseDetail("equipmentAccessStatus", true)}
                    type="button"
                  >
                    Issue or exception
                  </button>
                </div>
              </div>
              <label className={details.equipmentAccessStatus ? "" : "hidden"}>
                Equipment or access status
                <textarea
                  className={input}
                  disabled={!details.equipmentAccessStatus}
                  name="equipmentAccessStatus"
                  required={Boolean(details.equipmentAccessStatus)}
                  rows={2}
                />
              </label>
              <div className="grid gap-2">
                <span className="font-medium">Follow-up items</span>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Follow-up status"
                >
                  <button
                    aria-pressed={!details.followUpItems}
                    className="min-h-11 rounded-lg border border-white/20 px-3 aria-pressed:bg-[var(--accent-control)]"
                    onClick={() => chooseDetail("followUpItems", false)}
                    type="button"
                  >
                    None required
                  </button>
                  <button
                    aria-pressed={Boolean(details.followUpItems)}
                    className="min-h-11 rounded-lg border border-white/20 px-3 aria-pressed:bg-[var(--accent-control)]"
                    onClick={() => chooseDetail("followUpItems", true)}
                    type="button"
                  >
                    Follow-up required
                  </button>
                </div>
              </div>
              <label className={details.followUpItems ? "" : "hidden"}>
                Follow-up items
                <textarea
                  className={input}
                  disabled={!details.followUpItems}
                  name="followUpItems"
                  required={Boolean(details.followUpItems)}
                  rows={3}
                  placeholder="One item per line"
                />
              </label>
              <div className="grid gap-2">
                <span className="font-medium">Unusual conditions</span>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Unusual conditions status"
                >
                  <button
                    aria-pressed={!details.unusualConditions}
                    className="min-h-11 rounded-lg border border-white/20 px-3 aria-pressed:bg-[var(--accent-control)]"
                    onClick={() => chooseDetail("unusualConditions", false)}
                    type="button"
                  >
                    None
                  </button>
                  <button
                    aria-pressed={Boolean(details.unusualConditions)}
                    className="min-h-11 rounded-lg border border-white/20 px-3 aria-pressed:bg-[var(--accent-control)]"
                    onClick={() => chooseDetail("unusualConditions", true)}
                    type="button"
                  >
                    Document conditions
                  </button>
                </div>
              </div>
              <label className={details.unusualConditions ? "" : "hidden"}>
                Unusual conditions
                <textarea
                  className={input}
                  disabled={!details.unusualConditions}
                  name="unusualConditions"
                  required={Boolean(details.unusualConditions)}
                  rows={2}
                />
              </label>
            </fieldset>
          </div>
          <input type="hidden" name="submissionKey" value={key} />
          {draftEnabled ? <ReportingDraftControls draft={draft} /> : null}
          {embedded && !reviewing ? (
            <button
              className="min-h-12 rounded-lg bg-[var(--accent-control)] px-4 py-3 font-medium text-white"
              onClick={openReview}
              type="button"
            >
              Review before submitting
            </button>
          ) : null}
          {embedded && reviewing ? (
            <section
              aria-label="Closeout review"
              className="grid gap-3 rounded-lg border border-white/15 p-4"
            >
              <h3 className="text-lg font-semibold">Review before submit</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Submitting creates the canonical closeout and passdown.
                Corrections remain auditable.
              </p>
              <p>
                <strong>Shift summary:</strong> {review.summary}
              </p>
              {(
                [
                  "unresolvedIssues",
                  "equipmentAccessStatus",
                  "followUpItems",
                  "unusualConditions",
                ] as const
              ).map((name) => (
                <p key={name}>
                  <strong>{name.replace(/([A-Z])/g, " $1")}:</strong>{" "}
                  {review[name] || "None reported"}
                </p>
              ))}
              <button
                className="min-h-12 justify-self-start rounded-lg border border-white/20 px-4"
                onClick={() => setReviewing(false)}
                type="button"
              >
                Edit closeout
              </button>
            </section>
          ) : null}
          <button
            className={`${embedded && !reviewing ? "hidden" : ""} rounded-lg bg-white px-4 py-3 font-medium text-black disabled:opacity-60`}
            disabled={
              busy ||
              (draftEnabled &&
                (!draft.readyToSave ||
                  [
                    "loading",
                    "recovery-available",
                    "inaccessible",
                    "conflict",
                    "submitted",
                  ].includes(draft.status)))
            }
          >
            {busy ? "Submitting…" : "Submit end-of-shift report"}
          </button>
          {message ? <p role="status">{message}</p> : null}
        </form>
      )}
    </div>
  );
}
