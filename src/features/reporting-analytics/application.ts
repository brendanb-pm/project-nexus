import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";
import type { AnalyticsFilters, AnalyticsPageState } from "./contracts";
import type { ReportingAnalyticsService } from "./service";
import {
  incidentClassifications,
  incidentSeverities,
} from "@/features/reporting/contracts";

type Search = {
  window?: string;
  sitePage?: string;
  branchId?: string;
  clientId?: string;
  siteId?: string;
  incidentClassification?: string;
  incidentSeverity?: string;
  incidentStatus?: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAnalyticsFilters(input: Search): AnalyticsFilters {
  const hours = Number(input.window);
  return {
    windowHours: hours === 168 || hours === 720 ? hours : 24,
    ...(input.sitePage &&
    Number.isSafeInteger(Number(input.sitePage)) &&
    Number(input.sitePage) > 0
      ? { sitePage: Number(input.sitePage) }
      : {}),
    ...(input.branchId && uuid.test(input.branchId)
      ? { branchId: input.branchId }
      : {}),
    ...(input.clientId && uuid.test(input.clientId)
      ? { clientId: input.clientId }
      : {}),
    ...(input.siteId && uuid.test(input.siteId)
      ? { siteId: input.siteId }
      : {}),
    ...(incidentClassifications.includes(input.incidentClassification as never)
      ? { incidentClassification: input.incidentClassification }
      : {}),
    ...(incidentSeverities.includes(input.incidentSeverity as never)
      ? { incidentSeverity: input.incidentSeverity }
      : {}),
    ...(["SUBMITTED", "ACKNOWLEDGED", "APPROVED", "AMENDED"].includes(
      input.incidentStatus ?? "",
    )
      ? {
          incidentStatus:
            input.incidentStatus as AnalyticsFilters["incidentStatus"],
        }
      : {}),
  };
}

export async function loadReportingAnalytics(
  service: ReportingAnalyticsService | Promise<ReportingAnalyticsService>,
  input: Search,
): Promise<AnalyticsPageState> {
  try {
    return {
      kind: "ready",
      analytics: await (await service).load(parseAnalyticsFilters(input)),
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      return { kind: "denied" };
    return {
      kind: "error",
      message: "Reporting analytics are temporarily unavailable.",
    };
  }
}
