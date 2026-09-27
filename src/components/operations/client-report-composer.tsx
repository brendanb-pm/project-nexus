"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type {
  ClientReportCandidate,
  ClientReportCompositionOption,
  ClientReportDraft,
  ClientReportPublication,
} from "@/features/client-publication/contracts";
import {
  publishClientReport,
  saveClientReportDraft,
  type ClientReportActionState,
} from "@/app/operations/client-reports/actions";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
const idle: ClientReportActionState = { kind: "idle", message: "" };

function Submit({
  children,
  disabled = false,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-50"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

function Publish({ draft }: { draft: ClientReportDraft }) {
  const [state, action] = useActionState(publishClientReport, idle);
  // The key identifies one intended draft version for safe network replay;
  // it is not an authorization credential.
  const confirmationKey = `${draft.id.slice(0, 24)}${(draft.latestVersion + 1).toString(16).padStart(12, "0")}`;
  return (
    <form
      action={action}
      className="mt-3 grid gap-3 border-t border-white/10 pt-3"
    >
      <input type="hidden" name="draftId" value={draft.id} />
      <input
        type="hidden"
        name="expectedDraftRevision"
        value={draft.revision}
      />
      <input type="hidden" name="expectedVersion" value={draft.latestVersion} />
      <input type="hidden" name="confirmationKey" value={confirmationKey} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirmed" required />I reviewed the
        client-safe version, site, period, and selected sources. Publish a new
        immutable version to the client portal.
      </label>
      <div>
        <Submit>
          {draft.latestVersion
            ? "Publish superseding version"
            : "Publish version 1"}
        </Submit>
      </div>
      {state.message && (
        <p
          role="status"
          className={
            state.kind === "rejected" ? "text-red-400" : "text-green-400"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ClientReportComposer({
  options,
  selected,
  periodStart,
  periodEnd,
  candidates,
  drafts,
  publications,
  selectedDraft,
}: {
  options: readonly ClientReportCompositionOption[];
  selected: ClientReportCompositionOption | null;
  periodStart: string;
  periodEnd: string;
  candidates: readonly ClientReportCandidate[];
  drafts: readonly ClientReportDraft[];
  publications: readonly ClientReportPublication[];
  selectedDraft: ClientReportDraft | null;
}) {
  const [state, save] = useActionState(saveClientReportDraft, idle);
  const saved = new Map(
    selectedDraft?.selectedSources.map((source) => [
      `${source.kind}:${source.id}`,
      source.clientSummary,
    ]) ?? [],
  );
  const available = new Set(
    candidates.map((source) => `${source.kind}:${source.id}`),
  );
  const missingPriorSources = [...saved.keys()].filter(
    (key) => !available.has(key),
  );
  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-4 md:p-8">
      <header className={panel}>
        <p className="text-sm text-[var(--text-muted)]">
          Operations · Client publication
        </p>
        <h1 className="text-2xl font-semibold">Compose, review, and publish</h1>
        <p className="mt-2 text-sm">
          Only a confirmed published version reaches the client portal. Source
          narratives, participant records, and internal notes are not copied.
        </p>
      </header>
      <form
        method="get"
        className={`${panel} grid gap-3 sm:grid-cols-[1fr_auto_auto]`}
      >
        <input type="hidden" name="to" value={periodEnd} />
        <label className="grid gap-1 text-sm">
          Client and site
          <select
            name="site"
            defaultValue={selected?.siteId ?? ""}
            className="min-w-0 rounded border border-white/20 bg-[var(--card)] p-2"
          >
            {options.slice(0, 100).map((option) => (
              <option key={option.siteId} value={option.siteId}>
                {option.clientName} · {option.siteName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Window
          <select
            name="days"
            defaultValue="1"
            className="rounded border border-white/20 bg-[var(--card)] p-2"
          >
            <option value="1">24 hours</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
        </label>
        <button
          className="self-end rounded border border-white/20 px-4 py-2"
          type="submit"
        >
          Load sources
        </button>
        {options.length > 100 && (
          <p className="text-sm sm:col-span-3">
            Showing the first 100 authorized sites. This picker is
            display-limited; use a narrower authorized portfolio for other
            sites.
          </p>
        )}
      </form>
      {!selected ? (
        <section className={panel}>
          No authorized client sites are available.
        </section>
      ) : (
        <>
          <form action={save} className={`${panel} grid gap-4`}>
            <h2 className="text-xl font-semibold">
              {selectedDraft ? "Revise staged draft" : "Stage client report"}
            </h2>
            <p className="text-sm">
              {selected.clientName} · {selected.siteName} ·{" "}
              {new Date(periodStart).toLocaleDateString()}–
              {new Date(periodEnd).toLocaleDateString()}
            </p>
            <input type="hidden" name="clientId" value={selected.clientId} />
            <input type="hidden" name="siteId" value={selected.siteId} />
            <input type="hidden" name="periodStart" value={periodStart} />
            <input type="hidden" name="periodEnd" value={periodEnd} />
            <input
              type="hidden"
              name="expectedRevision"
              value={selectedDraft?.revision ?? 0}
            />
            <label className="grid gap-1">
              Executive summary
              <textarea
                name="executiveSummary"
                required
                minLength={3}
                maxLength={5000}
                defaultValue={selectedDraft?.executiveSummary}
                className="min-h-28 rounded border border-white/20 bg-[var(--card)] p-2"
              />
            </label>
            <label className="grid gap-1">
              Completion summary
              <textarea
                name="completionSummary"
                required
                minLength={3}
                maxLength={2000}
                defaultValue={selectedDraft?.completionSummary}
                className="min-h-20 rounded border border-white/20 bg-[var(--card)] p-2"
              />
            </label>
            <label className="grid gap-1">
              Follow-ups (one per line)
              <textarea
                name="followUps"
                defaultValue={selectedDraft?.followUps.join("\n")}
                className="min-h-16 rounded border border-white/20 bg-[var(--card)] p-2"
              />
            </label>
            <fieldset className="grid gap-3">
              <legend className="font-semibold">
                Reviewed client-visible sources (up to 50)
              </legend>
              <p className="text-sm text-[var(--text-muted)]">
                Only the newest 25 activities and 25 incidents in this window
                are offered. Client-safe summaries are written here by the
                reviewer.
              </p>
              {candidates.length ? (
                candidates.map((source) => {
                  const key = `${source.kind}:${source.id}`;
                  return (
                    <div
                      key={key}
                      className="grid gap-2 rounded border border-white/10 p-3"
                    >
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="source"
                          value={key}
                          defaultChecked={saved.has(key)}
                        />
                        {source.kind === "ACTIVITY" ? "Activity" : "Incident"} ·{" "}
                        {source.label} ·{" "}
                        {new Date(source.occurredAt).toLocaleString()}
                      </label>
                      <label className="grid gap-1 text-sm">
                        Client-safe summary
                        <input
                          name={`summary:${key}`}
                          defaultValue={saved.get(key) ?? ""}
                          maxLength={1000}
                          className="rounded border border-white/20 bg-[var(--card)] p-2"
                        />
                      </label>
                    </div>
                  );
                })
              ) : (
                <p>
                  No submitted client-visible sources in this window. A report
                  may still be composed without source records.
                </p>
              )}
            </fieldset>
            {missingPriorSources.length > 0 && (
              <p role="alert">
                This draft has selected sources outside the bounded picker. Its
                contents are preserved; do not revise until those sources are
                available for review.
              </p>
            )}
            <div>
              <Submit disabled={missingPriorSources.length > 0}>
                Save staged draft
              </Submit>
            </div>
            {state.message && (
              <p
                role="status"
                className={
                  state.kind === "rejected" ? "text-red-400" : "text-green-400"
                }
              >
                {state.message}
              </p>
            )}
          </form>
          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">
              Staged drafts · review and confirmation
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Showing at most the 25 most recently updated authorized drafts;
              this is a display limit, not a total count.
            </p>
            {drafts.length ? (
              drafts.map((draft) => (
                <article className={panel} key={draft.id}>
                  <h3 className="font-semibold">{draft.executiveSummary}</h3>
                  <p className="mt-2 text-sm">
                    Revision {draft.revision} · latest published version{" "}
                    {draft.latestVersion} ·{" "}
                    {new Date(draft.periodStart).toLocaleDateString()}–
                    {new Date(draft.periodEnd).toLocaleDateString()}
                  </p>
                  <p className="mt-2 text-sm">
                    Completion: {draft.completionSummary}
                  </p>
                  <p className="mt-2 text-sm">
                    Sites: {draft.siteIds.length} · selected sources:{" "}
                    {draft.selectedSources.length} · follow-ups:{" "}
                    {draft.followUps.length}
                  </p>
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      Review client-safe content before confirmation
                    </summary>
                    <p className="mt-2">
                      Period: {new Date(draft.periodStart).toLocaleString()} –{" "}
                      {new Date(draft.periodEnd).toLocaleString()}
                    </p>
                    <p>
                      Sites:{" "}
                      {draft.siteIds
                        .map(
                          (id) =>
                            options.find((option) => option.siteId === id)
                              ?.siteName ?? "Authorized site",
                        )
                        .join(", ")}
                    </p>
                    <ul className="mt-2 list-disc pl-5">
                      {draft.selectedSources.map((source) => (
                        <li key={`${source.kind}:${source.id}`}>
                          {source.kind}: {source.clientSummary}
                        </li>
                      ))}
                    </ul>
                    <ul className="mt-2 list-disc pl-5">
                      {draft.followUps.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </details>
                  <a
                    className="mt-2 inline-block underline"
                    href={`/operations/client-reports?site=${draft.siteIds[0]}&draft=${draft.id}`}
                  >
                    Review or revise
                  </a>
                  <Publish
                    key={`${draft.id}:${draft.revision}:${draft.latestVersion}`}
                    draft={draft}
                  />
                </article>
              ))
            ) : (
              <p className={panel}>
                No staged drafts in this authorized portfolio.
              </p>
            )}
          </section>
          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">Published versions</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Showing at most 25 recent authorized versions. Older immutable
              versions remain in history.
            </p>
            {publications.length ? (
              publications.map((item) => (
                <a
                  className={`${panel} block underline`}
                  key={item.id}
                  href={`/portal/reports/${item.id}`}
                >
                  {item.snapshot.clientName} · version {item.version} ·
                  published {new Date(item.publishedAt).toLocaleString()}
                </a>
              ))
            ) : (
              <p className={panel}>No published client reports yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
