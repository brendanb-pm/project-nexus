import {
  reportHubFamilies,
  reportHubStatuses,
  reportHubWindows,
  type ReportHubFilters,
  type ReportHubPageState,
} from "./contracts";
import type { ReportingHubService } from "./service";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "@/server/request/errors";

export type ReportHubSearchParams = {
  siteId?: string;
  family?: string;
  status?: string;
  window?: string;
  cursor?: string;
};

export function parseReportHubFilters(
  input: ReportHubSearchParams,
): ReportHubFilters {
  const parsedWindow = Number(input.window);
  return {
    windowHours: reportHubWindows.includes(parsedWindow as never)
      ? (parsedWindow as ReportHubFilters["windowHours"])
      : 24,
    ...(input.siteId && /^[0-9a-f-]{36}$/i.test(input.siteId)
      ? { siteId: input.siteId }
      : {}),
    ...(reportHubFamilies.includes(input.family as never)
      ? { family: input.family as ReportHubFilters["family"] }
      : {}),
    ...(reportHubStatuses.includes(input.status as never)
      ? { status: input.status as ReportHubFilters["status"] }
      : {}),
    ...(input.cursor ? { cursor: input.cursor } : {}),
  };
}

export async function loadReportingHub(
  serviceOrPromise: ReportingHubService | Promise<ReportingHubService>,
  input: ReportHubSearchParams,
): Promise<ReportHubPageState> {
  try {
    return await (await serviceOrPromise).load(parseReportHubFilters(input));
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof PermissionDeniedError
    )
      return { kind: "denied" };
    return {
      kind: "error",
      message:
        "Reports are temporarily unavailable. No reporting data was changed.",
    };
  }
}
