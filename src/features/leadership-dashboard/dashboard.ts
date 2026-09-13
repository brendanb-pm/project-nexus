import { buildComplianceWorkspace } from "@/features/compliance-workspace/workspace";
import { buildOperationalScorecards } from "@/features/operations/scorecards";
import type {
  OperationalPostScorecard,
  ScorecardMetric,
} from "@/features/operations/contracts";
import type {
  LeadershipDashboard,
  LeadershipDashboardSources,
} from "./contracts";

const submittedOrLater = new Set([
  "SUBMITTED",
  "ACKNOWLEDGED",
  "APPROVED",
  "AMENDED",
]);

const statusRank = { CRITICAL: 0, ATTENTION: 1, UPCOMING: 2 } as const;

function aggregateMetric(
  values: readonly ScorecardMetric[],
  label: string,
): ScorecardMetric {
  if (!values.length || values.every((value) => value.seconds === null))
    return { seconds: null, sourceState: "UNAVAILABLE", sourceLabel: label };
  return {
    seconds: values.reduce((sum, value) => sum + (value.seconds ?? 0), 0),
    sourceState: values.some((value) => value.sourceState !== "AVAILABLE")
      ? "PARTIAL"
      : "AVAILABLE",
    sourceLabel: label,
  };
}

function exception(post: OperationalPostScorecard, siteName: string) {
  if (
    post.status !== "CRITICAL" &&
    post.status !== "ATTENTION" &&
    post.status !== "UPCOMING"
  )
    return undefined;
  return {
    siteId: post.siteId,
    siteName,
    postId: post.id,
    postName: post.name,
    status: post.status,
    currentGapCount: post.currentGaps.length,
    upcomingGapCount: post.upcomingGaps.length,
    incompleteShiftCloseCount: post.shiftClose.incomplete,
    href: post.href,
  };
}

/** Pure aggregate projection; React receives no business-source rows or PII. */
export function buildLeadershipDashboard(
  sources: LeadershipDashboardSources,
  window: LeadershipDashboard["window"],
  organizationWide: boolean,
  selected: { clientId?: string; siteId?: string },
): LeadershipDashboard {
  const incidents = [
    ...new Map(
      sources.scorecards.incidents
        .filter((incident) => submittedOrLater.has(incident.status))
        .map((incident) => [incident.id, incident]),
    ).values(),
  ].map((incident) => ({
    id: incident.id,
    siteId: incident.siteId,
    ...(incident.postId ? { postId: incident.postId } : {}),
    occurredAt: incident.occurredAt,
  }));
  const scorecards = buildOperationalScorecards(
    { ...sources.scorecards, incidents },
    window,
  );
  const posts = scorecards.sites.flatMap((site) => site.posts);
  const required = aggregateMetric(
    posts.map((post) => post.required),
    "Sum of canonical Post CoverageRequirement-derived coverage",
  );
  const scheduled = aggregateMetric(
    posts.map((post) => post.scheduled),
    "Sum of canonical Post coverage-aligned assigned schedule",
  );
  const actual = aggregateMetric(
    posts.map((post) => post.actual),
    "Sum of authoritative Post TimeRecords",
  );
  const compliance = buildComplianceWorkspace(
    sources.compliance,
    new Date(window.asOf),
  ).summary;
  const exceptions = scorecards.sites
    .flatMap((site) =>
      site.posts.map((post) => exception(post, site.name)).filter(Boolean),
    )
    .sort(
      (a, b) =>
        statusRank[a!.status] - statusRank[b!.status] ||
        a!.siteName.localeCompare(b!.siteName) ||
        a!.postName.localeCompare(b!.postName) ||
        a!.postId.localeCompare(b!.postId),
    )
    .slice(0, 20) as LeadershipDashboard["exceptions"];

  const requiredSeconds = required.seconds;
  const scheduledSeconds = scheduled.seconds;
  return {
    scopeLabel: organizationWide ? "Organization" : "Authorized portfolio",
    window,
    filters: {
      clients: sources.hierarchy.clients,
      sites: selected.clientId
        ? sources.hierarchy.sites.filter(
            (site) => site.clientId === selected.clientId,
          )
        : sources.hierarchy.sites,
      ...(selected.clientId ? { selectedClientId: selected.clientId } : {}),
      ...(selected.siteId ? { selectedSiteId: selected.siteId } : {}),
    },
    operationalHealth: {
      required,
      scheduled,
      actual,
      coveragePercent:
        requiredSeconds && scheduledSeconds !== null
          ? Math.round((scheduledSeconds / requiredSeconds) * 1000) / 10
          : null,
      currentGapCount: posts.reduce(
        (sum, post) => sum + post.currentGaps.length,
        0,
      ),
      upcomingGapCount: posts.reduce(
        (sum, post) => sum + post.upcomingGaps.length,
        0,
      ),
      scheduledStaffing: posts.reduce(
        (total, post) => ({
          assigned: total.assigned + post.activeStaffing.assigned,
          required: total.required + post.activeStaffing.required,
        }),
        { assigned: 0, required: 0 },
      ),
      shiftClose: posts.reduce(
        (total, post) => ({
          due: total.due + post.shiftClose.due,
          complete: total.complete + post.shiftClose.complete,
          incomplete: total.incomplete + post.shiftClose.incomplete,
        }),
        { due: 0, complete: 0, incomplete: 0 },
      ),
    },
    incidents: { submittedOrLater: incidents.length },
    compliance: {
      blockingAssignment: compliance.BLOCKING_ASSIGNMENT,
      expiredOrRestricted: compliance.EXPIRED_OR_RESTRICTED,
      missingRequired: compliance.MISSING_REQUIRED,
      pendingVerification: compliance.PENDING_VERIFICATION,
      expiringSoon: compliance.EXPIRING_SOON,
    },
    exceptions,
    financial: {
      state: "UNAVAILABLE",
      message:
        "Financial performance is unavailable until canonical billing and payroll foundations are implemented.",
    },
  };
}
