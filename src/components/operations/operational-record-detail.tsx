"use client";

import { useState } from "react";
import type { OperationalRecordDetailState } from "@/features/operations/record-detail";
import type { ReviewRecord } from "@/features/reporting/contracts";
import { PresentationStatusBadge } from "@/components/ui/presentation-status";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2";

export function OperationalRecordDetail({
  state,
  actions,
}: {
  state: OperationalRecordDetailState;
  actions?: {
    acknowledge(form: FormData): Promise<ReviewRecord>;
    amend(form: FormData): Promise<ReviewRecord>;
  };
}) {
  const [review, setReview] = useState(
    state.kind === "ready" ? state.review : undefined,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");

  if (state.kind === "unavailable")
    return (
      <section className={panel} role="alert">
        <h1 className="text-2xl font-semibold">Record unavailable</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          This record is stale, invalid, or outside your authorized scope.
        </p>
        <a
          className="mt-4 inline-flex min-h-11 items-center underline"
          href="/operations"
        >
          Return to Operations
        </a>
      </section>
    );
  if (state.kind === "error")
    return (
      <section className={panel} role="alert">
        <h1 className="text-2xl font-semibold">
          Record temporarily unavailable
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          The record could not be loaded safely. Try again.
        </p>
      </section>
    );

  const record = state.record;
  const acknowledged = Boolean(review?.acknowledgedAt) || !record.actionable;

  async function acknowledge() {
    if (!actions || !review || busy) return;
    setBusy(true);
    setMessage("Acknowledging record…");
    try {
      const form = new FormData();
      form.set("entityType", review.entityType);
      form.set("recordId", review.id);
      setReview(await actions.acknowledge(form));
      setMessage("Record acknowledged. It now appears in History.");
    } catch {
      setMessage("Acknowledgement failed. Refresh and retry safely.");
    } finally {
      setBusy(false);
    }
  }

  async function amend() {
    if (!actions || !review || busy) return;
    if (reason.trim().length < 3 || !detail.trim()) {
      setMessage(
        "Enter a reason and corrected detail before recording an amendment.",
      );
      return;
    }
    setBusy(true);
    setMessage("Recording amendment…");
    try {
      const form = new FormData();
      form.set("entityType", review.entityType);
      form.set("recordId", review.id);
      form.set("expectedRevision", String(review.revision));
      form.set("reason", reason.trim());
      form.set("amendment", JSON.stringify({ narrative: detail.trim() }));
      form.set("idempotencyKey", crypto.randomUUID());
      setReview(await actions.amend(form));
      setReason("");
      setDetail("");
      setMessage(
        "Amendment appended. The original submission remains unchanged.",
      );
    } catch {
      setMessage("Amendment failed. Refresh for conflicts, then retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--text-muted)]">
        <a className="underline" href="/operations">
          Operations
        </a>
        <span aria-hidden="true"> / </span>
        <span>{record.typeLabel}</span>
      </nav>
      <section className={panel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-[var(--text-muted)]">
              {record.typeLabel}
            </p>
            <h1 className="mt-1 break-words text-2xl font-semibold">
              {record.siteName} — {record.postName}
            </h1>
          </div>
          <PresentationStatusBadge
            value={
              acknowledged && review?.acknowledgedAt
                ? "ACKNOWLEDGED"
                : record.status
            }
          />
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Author
            </dt>
            <dd className="mt-1 break-words">{record.actorName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Recorded
            </dt>
            <dd className="mt-1">
              {new Intl.DateTimeFormat(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZoneName: "short",
              }).format(new Date(record.timestamp))}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Record identity
            </dt>
            <dd className="mt-1 break-all font-mono text-sm">{record.id}</dd>
          </div>
        </dl>
      </section>

      <section className={panel} aria-labelledby="original-record-heading">
        <h2 id="original-record-heading" className="text-xl font-semibold">
          Original record
        </h2>
        <dl className="mt-3 grid gap-4">
          {state.fields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                {field.label}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {review ? (
        <section className={panel} aria-labelledby="record-progression-heading">
          <h2 id="record-progression-heading" className="text-xl font-semibold">
            Acknowledgement & amendment history
          </h2>
          <ol className="mt-3 grid gap-3">
            <li className="rounded-lg border border-white/10 p-3">
              <strong>Original submission</strong>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Authored by {record.actorName}. Original values remain
                unchanged.
              </p>
            </li>
            {review.acknowledgedAt ? (
              <li className="rounded-lg border border-white/10 p-3">
                <strong>Acknowledged</strong>
                <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
                  {new Date(review.acknowledgedAt).toLocaleString()} ·{" "}
                  {review.acknowledgedByName ?? review.acknowledgedByUserId}
                </p>
              </li>
            ) : null}
            {review.history.map((revision) => (
              <li
                className="rounded-lg border border-white/10 p-3"
                key={revision.revision}
              >
                <strong>Revision {revision.revision}</strong>
                <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
                  {revision.changedByName ?? revision.changedByUserId} ·{" "}
                  {new Date(revision.changedAt).toLocaleString()}
                </p>
                <p className="mt-1">Reason: {revision.reason}</p>
                <p className="mt-1 break-words text-sm">
                  Corrected detail:{" "}
                  {String(
                    revision.snapshot.narrative ??
                      "Recorded in revision snapshot",
                  )}
                </p>
              </li>
            ))}
          </ol>
          {!acknowledged ? (
            <button
              type="button"
              className="mt-4 min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-60"
              disabled={busy}
              onClick={acknowledge}
            >
              {busy ? "Working…" : "Acknowledge record"}
            </button>
          ) : null}
          <div className="mt-5 grid gap-3 border-t border-white/10 pt-4">
            <h3 className="font-semibold">Append an amendment</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Amendments add a revision with actor and reason; they do not
              rewrite the original.
            </p>
            <label className="text-sm">
              Amendment reason
              <textarea
                className={input}
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <label className="text-sm">
              Corrected detail
              <textarea
                className={input}
                rows={3}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="min-h-11 justify-self-start rounded-lg border border-white/20 px-4 py-2 font-medium disabled:opacity-60"
              disabled={busy}
              onClick={amend}
            >
              {busy ? "Working…" : "Record amendment"}
            </button>
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]" role="status">
            {message}
          </p>
        </section>
      ) : (
        <section className={panel}>
          <h2 className="text-xl font-semibold">Record history</h2>
          <p className="mt-2 text-[var(--text-muted)]">
            This completed EOSR is informational. No pending review action is
            represented.
          </p>
        </section>
      )}
    </div>
  );
}
