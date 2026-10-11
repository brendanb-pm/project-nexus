import Link from "next/link";
import { notFound } from "next/navigation";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import type { ReportingExceptionDossier } from "@/features/reporting-exceptions/contracts";
import { createReportingExceptionService } from "@/features/reporting-exceptions/server";
import {
  PermissionDeniedError,
  ResourceNotFoundError,
} from "@/server/request/errors";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-4 md:p-5";

function human(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function at(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(new Date(value));
}

function Evidence({ dossier }: { dossier: ReportingExceptionDossier }) {
  const { evidence } = dossier;
  return (
    <section className={panel} aria-labelledby="evidence-heading">
      <h2 id="evidence-heading" className="text-xl font-bold">
        Assignment evidence
      </h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Source records remain authoritative. Only submitted records appear here;
        drafts and narratives are not copied into this dossier.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-[var(--text-muted)]">Clock-out</dt>
          <dd>
            {evidence.clockOutAt
              ? at(evidence.clockOutAt, dossier.context.siteTimezone)
              : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--text-muted)]">Shift closeout</dt>
          <dd>
            {evidence.closeout ? (
              <a
                className="underline"
                href={`/operations/records/eosr/${evidence.closeout.id}`}
              >
                Submitted{" "}
                {at(
                  evidence.closeout.submittedAt,
                  dossier.context.siteTimezone,
                )}
              </a>
            ) : (
              "Not submitted"
            )}
          </dd>
        </div>
      </dl>
      <h3 className="mt-5 font-semibold">Activity timeline</h3>
      {evidence.activities.length ? (
        <ul className="mt-2 grid gap-2">
          {evidence.activities.map((entry) => (
            <li key={entry.id}>
              <a
                className="underline"
                href={`/operations/records/activity/${entry.id}`}
              >
                {at(entry.occurredAt, dossier.context.siteTimezone)} ·{" "}
                {human(entry.category)}
                {entry.incidentGate === "REQUIRED"
                  ? " · Incident report required"
                  : ""}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2">No submitted activities for this assignment.</p>
      )}
      {evidence.activityHasMore ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Showing the 20 most recent activities. This is not a complete count.
        </p>
      ) : null}
      <h3 className="mt-5 font-semibold">Linked Security Incident Reports</h3>
      {evidence.incidents.length ? (
        <ul className="mt-2 grid gap-2">
          {evidence.incidents.map((incident) => (
            <li key={incident.id}>
              <a
                className="underline"
                href={`/operations/records/incident/${incident.id}`}
              >
                {incident.incidentNumber} · {human(incident.classification)} ·{" "}
                {human(incident.severity)}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2">
          No submitted incident report for this assignment.
        </p>
      )}
      {evidence.incidentHasMore ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Showing the 20 most recent incidents. This is not a complete count.
        </p>
      ) : null}
    </section>
  );
}

export default async function ReportingExceptionDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await createReportingExceptionService(
    await createProductionPrincipalResolver(),
    "reporting-exceptions.dossier",
  );
  let dossier: ReportingExceptionDossier;
  try {
    dossier = await service.dossier(id);
  } catch (error) {
    if (
      error instanceof ResourceNotFoundError ||
      error instanceof PermissionDeniedError
    )
      notFound();
    throw error;
  }
  const { exception, context } = dossier;
  return (
    <main className="mx-auto grid max-w-5xl gap-5 p-4 pb-8 md:p-6">
      <header className={panel}>
        <Link
          className="text-sm underline"
          href="/operations/reporting-exceptions"
        >
          Back to reporting exceptions
        </Link>
        <h1 className="mt-3 text-2xl font-bold">
          Reporting exception evidence
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          {human(exception.classification)} {human(exception.obligationType)} ·{" "}
          {human(exception.state)}
        </p>
      </header>
      <section className={panel} aria-labelledby="assignment-heading">
        <h2 id="assignment-heading" className="text-xl font-bold">
          Assignment context
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[var(--text-muted)]">
              Client and site
            </dt>
            <dd>
              {context.clientName} · {context.siteName}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--text-muted)]">Post</dt>
            <dd>{context.postName}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--text-muted)]">Guard</dt>
            <dd>
              {context.employeeEmail ?? `Employee ${context.employeeNumber}`}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--text-muted)]">Assignment</dt>
            <dd>{human(context.assignmentStatus)}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--text-muted)]">
              Scheduled shift
            </dt>
            <dd>
              {at(context.scheduledStart, context.siteTimezone)}–
              {at(context.scheduledEnd, context.siteTimezone)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--text-muted)]">Effective end</dt>
            <dd>{at(exception.effectiveShiftEndAt, context.siteTimezone)}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--text-muted)]">Due</dt>
            <dd>{at(exception.dueAt, context.siteTimezone)}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--text-muted)]">First detected</dt>
            <dd>{at(exception.firstDetectedAt, context.siteTimezone)}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--text-muted)]">Correction</dt>
            <dd>
              {exception.correctedAt
                ? at(exception.correctedAt, context.siteTimezone)
                : "Pending"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--text-muted)]">Owner</dt>
            <dd>
              {exception.assigneeUserId
                ? (dossier.actors[exception.assigneeUserId] ?? "Former user")
                : "Unassigned"}
            </dd>
          </div>
        </dl>
      </section>
      <Evidence dossier={dossier} />
      <section className={panel} aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-xl font-bold">
          Immutable lifecycle history
        </h2>
        <ol className="mt-4 grid gap-3">
          {[...dossier.history].reverse().map((event) => (
            <li
              className="rounded-lg border border-white/10 p-3"
              key={event.id}
            >
              <p className="font-semibold">
                {human(event.nextState)} ·{" "}
                {at(event.occurredAt, context.siteTimezone)}
              </p>
              <p className="text-sm">
                {event.actor === "SYSTEM"
                  ? "System"
                  : event.actorUserId
                    ? (dossier.actors[event.actorUserId] ?? "Former user")
                    : "Authorized user"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {event.reason}
              </p>
            </li>
          ))}
        </ol>
        <Link
          className="mt-5 inline-block underline"
          href="/operations/reporting-exceptions"
        >
          Return to the authorized lifecycle actions
        </Link>
      </section>
    </main>
  );
}
