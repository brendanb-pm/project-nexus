import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientReportPrintButton } from "@/components/client/client-report-print-button";
import { createClientPublicationService } from "@/features/client-publication/server";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";

export default async function PublishedClientReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let report;
  try {
    const service = await createClientPublicationService(
      "client-report.published-page",
    );
    report = await service.publication((await params).id);
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      notFound();
    throw error;
  }
  if (!report) notFound();
  const { snapshot } = report;
  return (
    <main className="client-report-print mx-auto max-w-4xl p-4 md:p-8 print:max-w-none print:text-black">
      <nav className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/portal" className="underline">
          ← Published reports
        </Link>
        <ClientReportPrintButton />
      </nav>
      <article className="rounded-xl border border-white/10 bg-[var(--card)] p-5 print:rounded-none print:border-0 print:bg-white print:p-0">
        <header className="border-b border-white/20 pb-4 print:border-black/20">
          <p className="text-sm uppercase tracking-widest">
            Nexus · Client Report
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{snapshot.clientName}</h1>
          <p className="mt-2">
            {snapshot.sites.map((site) => site.name).join(", ")}
          </p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Reporting period</dt>
              <dd>
                {new Date(snapshot.periodStart).toLocaleString()} –{" "}
                {new Date(snapshot.periodEnd).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Published version</dt>
              <dd>
                {report.version} ·{" "}
                {new Date(report.publishedAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Version status</dt>
              <dd>
                {report.isCurrent ? "Current" : "Superseded historical version"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Report ID</dt>
              <dd className="break-all">{report.id}</dd>
            </div>
            {report.supersedesId && (
              <div>
                <dt className="font-semibold">Supersedes</dt>
                <dd className="break-all">{report.supersedesId}</dd>
              </div>
            )}
          </dl>
        </header>
        <section className="mt-6">
          <h2 className="text-xl font-semibold">Executive summary</h2>
          <p className="mt-2 whitespace-pre-wrap">
            {snapshot.executiveSummary}
          </p>
        </section>
        <section className="mt-6 break-inside-avoid">
          <h2 className="text-xl font-semibold">Completion</h2>
          <p className="mt-2 whitespace-pre-wrap">
            {snapshot.completionSummary}
          </p>
        </section>
        <section className="mt-6">
          <h2 className="text-xl font-semibold">Reviewed source summaries</h2>
          {snapshot.sources.length ? (
            <ol className="mt-3 grid gap-3">
              {snapshot.sources.map((source) => (
                <li
                  key={`${source.kind}:${source.id}`}
                  className="break-inside-avoid rounded border border-white/10 p-3 print:border-black/20"
                >
                  <strong>
                    {source.kind === "ACTIVITY"
                      ? `Activity · ${source.category}`
                      : `Security Incident · ${source.incidentNumber}`}
                  </strong>
                  <p className="mt-1 text-sm">
                    {new Date(source.occurredAt).toLocaleString()}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">
                    {source.clientSummary}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2">No source records selected for this version.</p>
          )}
        </section>
        <section className="mt-6 break-inside-avoid">
          <h2 className="text-xl font-semibold">Follow-ups</h2>
          {snapshot.followUps.length ? (
            <ul className="mt-2 list-disc pl-5">
              {snapshot.followUps.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2">No follow-ups recorded.</p>
          )}
        </section>
      </article>
    </main>
  );
}
