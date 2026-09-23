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
    },
    clearPayload: () => formRef.current?.reset(),
  });
  async function onSubmit(form: FormData) {
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
      ) : (
        <form
          action={draftEnabled ? undefined : onSubmit}
          className="grid gap-4 rounded-xl border border-white/10 bg-[var(--card)] p-5"
          onChange={draftEnabled ? draft.changed : undefined}
          onInput={draftEnabled ? draft.changed : undefined}
          onSubmit={
            draftEnabled
              ? (event) => {
                  event.preventDefault();
                  void onSubmit(new FormData(event.currentTarget));
                }
              : undefined
          }
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
              <textarea
                className={input}
                name="equipmentAccessStatus"
                rows={2}
              />
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
          {draftEnabled ? <ReportingDraftControls draft={draft} /> : null}
          <button
            className="rounded-lg bg-white px-4 py-3 font-medium text-black disabled:opacity-60"
            disabled={
              busy ||
              (draftEnabled &&
                [
                  "loading",
                  "recovery-available",
                  "inaccessible",
                  "conflict",
                  "submitted",
                ].includes(draft.status))
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
