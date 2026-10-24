import { notFound, redirect } from "next/navigation";
import { ClientReportComposer } from "@/components/operations/client-report-composer";
import { createClientPublicationService } from "@/features/client-publication/server";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";

export default async function ClientReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    site?: string;
    days?: string;
    draft?: string;
    to?: string;
  }>;
}) {
  let view: React.ComponentProps<typeof ClientReportComposer>;
  try {
    const service = await createClientPublicationService(
      "client-report.compose-page",
    );
    const query = await searchParams;
    if (!query.to && !query.draft) {
      const params = new URLSearchParams();
      if (query.site) params.set("site", query.site);
      if (query.days) params.set("days", query.days);
      params.set("to", new Date().toISOString());
      redirect(`/operations/client-reports?${params}`);
    }
    const [options, drafts, publications] = await Promise.all([
      service.compositionOptions(),
      service.listDrafts(),
      service.listPublished(),
    ]);
    const selectedDraft =
      drafts.find((draft) => draft.id === query.draft) ?? null;
    const selected =
      options
        .slice(0, 100)
        .find(
          (option) =>
            option.siteId === (selectedDraft?.siteIds[0] ?? query.site),
        ) ??
      options[0] ??
      null;
    const days = query.days === "7" ? 7 : query.days === "30" ? 30 : 1;
    const now = new Date();
    const requestedEnd = query.to ? new Date(query.to) : now;
    const end = selectedDraft
      ? new Date(selectedDraft.periodEnd)
      : Number.isFinite(requestedEnd.valueOf()) &&
          requestedEnd.valueOf() <= now.valueOf() + 60_000 &&
          requestedEnd.valueOf() >= now.valueOf() - 31 * 24 * 60 * 60 * 1000
        ? requestedEnd
        : now;
    const start = selectedDraft
      ? new Date(selectedDraft.periodStart)
      : new Date(end.valueOf() - days * 24 * 60 * 60 * 1000);
    const candidates = selected
      ? await service.candidates(
          selected.clientId,
          selected.siteId,
          start.toISOString(),
          end.toISOString(),
        )
      : [];
    view = {
      options,
      selected,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      candidates,
      drafts,
      publications,
      selectedDraft,
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      notFound();
    throw error;
  }
  return <ClientReportComposer {...view} />;
}
