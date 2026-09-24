"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DraftFamily,
  ReportingDraft,
} from "@/features/reporting-drafts/contracts";
import {
  discardReportingDraft,
  recoverReportingDraft,
  saveReportingDraft,
  submitReportingDraft,
} from "@/app/reporting/draft-actions";

type DraftStatus =
  | "loading"
  | "ready"
  | "recovery-available"
  | "unsaved"
  | "saving"
  | "saved"
  | "retry"
  | "conflict"
  | "inaccessible"
  | "submitting"
  | "submitted"
  | "discarded"
  | "expired";

const freshKey = () => crypto.randomUUID();

export function useReportingDraft({
  assignmentId,
  family,
  enabled = true,
  readPayload,
  restorePayload,
  clearPayload,
}: {
  assignmentId: string;
  family: DraftFamily;
  enabled?: boolean;
  readPayload: () => Record<string, unknown>;
  restorePayload: (payload: Record<string, unknown>) => void;
  clearPayload: () => void;
}) {
  const [status, setStatus] = useState<DraftStatus>(
    enabled ? "loading" : "ready",
  );
  const [draft, setDraft] = useState<ReportingDraft | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<ReportingDraft | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [readyToSave, setReadyToSave] = useState(!enabled);
  const draftRef = useRef<ReportingDraft | null>(null);
  const readyRef = useRef(false);
  const pendingRecoveryRef = useRef<ReportingDraft | null>(null);
  const clientKeyRef = useRef<string>(freshKey());
  const submissionKeyRef = useRef<string>(freshKey());
  const lastSavedRef = useRef("");
  const pendingSaveRef = useRef<{
    payload: string;
    revision: number;
    key: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const pendingEditRef = useRef(false);
  const flushRef = useRef<() => Promise<boolean>>(async () => false);
  const recoverySequenceRef = useRef(0);
  const readRef = useRef(readPayload);
  const restoreRef = useRef(restorePayload);
  const clearRef = useRef(clearPayload);
  useEffect(() => {
    readRef.current = readPayload;
    restoreRef.current = restorePayload;
    clearRef.current = clearPayload;
  }, [readPayload, restorePayload, clearPayload]);

  const load = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++recoverySequenceRef.current;
    try {
      const result = await recoverReportingDraft(assignmentId, family);
      if (sequence !== recoverySequenceRef.current) return;
      if (result.kind === "found") {
        pendingRecoveryRef.current = result.draft;
        setPendingRecovery(result.draft);
        setStatus("recovery-available");
        setMessage(
          pendingEditRef.current
            ? "Saved draft available. Your current unsaved changes remain on this device until you choose how to proceed."
            : "Saved draft available. Restore it or discard it before continuing.",
        );
      } else if (result.kind === "empty" || result.kind === "expired") {
        readyRef.current = true;
        setReadyToSave(true);
        setStatus(result.kind === "expired" ? "expired" : "ready");
        if (result.kind === "expired")
          setMessage("Draft expired after 30 days and cannot be recovered.");
        if (pendingEditRef.current) {
          pendingEditRef.current = false;
          setTimeout(() => void flushRef.current(), 0);
        }
      } else {
        setStatus("inaccessible");
      }
    } catch {
      if (sequence !== recoverySequenceRef.current) return;
      setStatus("retry");
      setMessage(
        "Draft recovery is unavailable. Try again before entering sensitive information.",
      );
    }
  }, [assignmentId, family, enabled]);

  useEffect(() => {
    queueMicrotask(() => void load());
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load]);

  function restore() {
    const recovered = pendingRecoveryRef.current;
    if (!recovered) return;
    recoverySequenceRef.current++;
    restoreRef.current(recovered.payload);
    draftRef.current = recovered;
    setDraft(recovered);
    clientKeyRef.current = recovered.clientDraftKey;
    submissionKeyRef.current = recovered.submissionKey;
    lastSavedRef.current = JSON.stringify(recovered.payload);
    pendingSaveRef.current = null;
    pendingRecoveryRef.current = null;
    pendingEditRef.current = false;
    setPendingRecovery(null);
    readyRef.current = true;
    setReadyToSave(true);
    setStatus("saved");
    setMessage("Saved draft restored.");
  }

  async function saveNow(
    submissionPayload?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!readyRef.current || pendingRecoveryRef.current) return false;
    const frozenSubmission = submissionPayload
      ? JSON.stringify(submissionPayload)
      : null;
    while (savingRef.current) await savingRef.current;
    const current = frozenSubmission ?? JSON.stringify(readRef.current());
    if (current === lastSavedRef.current) return true;
    const revision = draftRef.current?.revision ?? 0;
    const pending = pendingSaveRef.current;
    const saveKey =
      pending?.payload === current && pending.revision === revision
        ? pending.key
        : freshKey();
    pendingSaveRef.current = { payload: current, revision, key: saveKey };
    const form = new FormData();
    form.set("shiftAssignmentId", assignmentId);
    form.set("family", family);
    form.set("clientDraftKey", clientKeyRef.current);
    form.set("submissionKey", submissionKeyRef.current);
    form.set("saveKey", saveKey);
    form.set("expectedRevision", String(revision));
    form.set("payload", current);
    setStatus("saving");
    const task = (async () => {
      try {
        const result = await saveReportingDraft(form);
        if (result.kind === "saved") {
          draftRef.current = result.draft;
          setDraft(result.draft);
          lastSavedRef.current = current;
          pendingSaveRef.current = null;
          setStatus("saved");
          setMessage("Saved securely. Available after you sign in again.");
          return true;
        }
        setStatus(
          result.kind === "conflict"
            ? "conflict"
            : result.kind === "inaccessible"
              ? "inaccessible"
              : "retry",
        );
        setMessage(
          result.kind === "conflict"
            ? "Saved draft changed elsewhere. Your current text is still here. Refresh to review the saved version."
            : result.kind === "inaccessible"
              ? "Assignment no longer accessible to your account."
              : "Save failed—your text is still here. Correct the content and retry.",
        );
        return false;
      } catch {
        setStatus("retry");
        setMessage(
          "Save failed—your text is still here. Could not save this draft. Retry when connected.",
        );
        return false;
      }
    })();
    savingRef.current = task;
    try {
      return await task;
    } finally {
      savingRef.current = null;
    }
  }

  useEffect(() => {
    flushRef.current = saveNow;
  });

  function changed() {
    if (!readyRef.current) {
      pendingEditRef.current = true;
      setStatus("unsaved");
      setMessage(
        "Checking for a saved draft; your changes are still on this device.",
      );
      return;
    }
    if (pendingRecoveryRef.current || status === "submitting") return;
    setStatus("unsaved");
    setMessage("Unsaved changes on this device.");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveNow();
    }, 750);
  }

  async function submit() {
    if (timerRef.current) clearTimeout(timerRef.current);
    const submissionPayload = readRef.current();
    if (!(await saveNow(submissionPayload)))
      return { kind: "save-failed" as const };
    const current = draftRef.current;
    if (!current) return { kind: "save-failed" as const };
    setStatus("submitting");
    try {
      const result = await submitReportingDraft(
        assignmentId,
        current.id,
        current.revision,
      );
      if (result.kind === "submitted" || result.kind === "already-submitted") {
        draftRef.current = null;
        setDraft(null);
        lastSavedRef.current = "";
        pendingSaveRef.current = null;
        clientKeyRef.current = freshKey();
        submissionKeyRef.current = freshKey();
        setStatus("submitted");
        setMessage("Submitted. Draft retired and no longer recoverable.");
      } else {
        setStatus(
          result.kind === "conflict"
            ? "conflict"
            : result.kind === "inaccessible"
              ? "inaccessible"
              : "retry",
        );
        setMessage(
          result.kind === "conflict"
            ? "Saved draft changed elsewhere. Review and retry."
            : result.kind === "inaccessible"
              ? "Assignment no longer accessible to your account."
              : "Submission needs correction. Your saved draft is retained.",
        );
      }
      return result;
    } catch {
      setStatus("retry");
      setMessage(
        "Confirmation was lost. Your saved draft is retained; retry checks the same submission.",
      );
      return { kind: "confirmation-unknown" as const };
    }
  }

  async function discard() {
    const current = draftRef.current ?? pendingRecoveryRef.current;
    if (
      !current ||
      !window.confirm(
        "Discard this saved draft and any current unsaved changes permanently?",
      )
    )
      return;
    try {
      const result = await discardReportingDraft(
        assignmentId,
        current.id,
        current.revision,
      );
      if (result.kind !== "discarded") {
        setStatus(result.kind);
        setMessage("The draft could not be discarded. Refresh and review it.");
        return;
      }
      draftRef.current = null;
      pendingRecoveryRef.current = null;
      recoverySequenceRef.current++;
      pendingEditRef.current = false;
      setDraft(null);
      setPendingRecovery(null);
      lastSavedRef.current = "";
      pendingSaveRef.current = null;
      clientKeyRef.current = freshKey();
      submissionKeyRef.current = freshKey();
      readyRef.current = true;
      setReadyToSave(true);
      clearRef.current();
      setStatus("discarded");
      setMessage("Draft discarded. Its content cannot be recovered.");
    } catch {
      setStatus("retry");
      setMessage("Could not confirm discard. Retry after reconnecting.");
    }
  }

  return {
    status,
    draft,
    pendingRecovery,
    message,
    readyToSave,
    changed,
    saveNow,
    submit,
    restore,
    discard,
    retryRecovery: load,
  };
}

export function ReportingDraftControls({
  draft,
}: {
  draft: ReturnType<typeof useReportingDraft>;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-white/15 p-3 text-sm">
      <p aria-live="polite" role="status">
        {draft.status === "loading"
          ? "Checking for a saved draft…"
          : draft.status === "saving"
            ? "Saving…"
            : draft.message || "Draft ready."}
      </p>
      {draft.pendingRecovery ? (
        <div className="flex flex-wrap gap-2">
          <button
            className="min-h-12 rounded-lg border border-white/25 px-3 font-semibold"
            onClick={draft.restore}
            type="button"
          >
            Restore saved draft
          </button>
          <button
            className="min-h-12 rounded-lg border border-red-400/40 px-3 font-semibold"
            onClick={() => void draft.discard()}
            type="button"
          >
            Discard saved draft
          </button>
        </div>
      ) : null}
      {draft.draft && draft.status !== "submitted" ? (
        <div className="flex flex-wrap gap-2">
          <button
            className="min-h-12 rounded-lg border border-white/25 px-3 font-semibold"
            onClick={() => void draft.saveNow()}
            type="button"
          >
            Save now / retry
          </button>
          <button
            className="min-h-12 rounded-lg border border-red-400/40 px-3 font-semibold"
            onClick={() => void draft.discard()}
            type="button"
          >
            Discard draft
          </button>
        </div>
      ) : null}
      {draft.status === "retry" && !draft.draft && draft.readyToSave ? (
        <button
          className="min-h-12 rounded-lg border border-white/25 px-3 font-semibold"
          onClick={() => void draft.saveNow()}
          type="button"
        >
          Save now / retry
        </button>
      ) : null}
      {draft.status === "retry" && !draft.draft && !draft.readyToSave ? (
        <button
          className="min-h-12 rounded-lg border border-white/25 px-3 font-semibold"
          onClick={() => void draft.retryRecovery()}
          type="button"
        >
          Retry recovery
        </button>
      ) : null}
    </div>
  );
}
