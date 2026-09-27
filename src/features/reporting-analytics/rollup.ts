import type {
  AnalyticsFilters,
  AnalyticsLocation,
  AnalyticsMetric,
  AnalyticsRollup,
  AnalyticsSources,
  ReportingAnalytics,
} from "./contracts";

type Mutable = {
  key: string;
  label: string;
  eligible: number;
  due: number;
  completed: number;
  eosrOnly: number;
  onTimeCloseout: number;
  activitySatisfied: number;
  activityDueSatisfied: number;
  incidentCount: number;
  incidentDistribution: Map<string, number>;
  openExceptionCount: number;
  oldestOpenExceptionHours: number | null;
  turnaroundHoursTotal: number;
  turnaroundCount: number;
};

const openStates = new Set([
  "OPEN",
  "ACKNOWLEDGED",
  "CORRECTION_REQUESTED",
  "CORRECTED_PENDING_REVIEW",
  "ESCALATED",
]);

function metric(numerator: number, denominator: number): AnalyticsMetric {
  return {
    numerator,
    denominator,
    percent: denominator
      ? Math.round((numerator / denominator) * 1000) / 10
      : null,
  };
}

function create(key: string, label: string): Mutable {
  return {
    key,
    label,
    eligible: 0,
    due: 0,
    completed: 0,
    eosrOnly: 0,
    onTimeCloseout: 0,
    activitySatisfied: 0,
    activityDueSatisfied: 0,
    incidentCount: 0,
    incidentDistribution: new Map(),
    openExceptionCount: 0,
    oldestOpenExceptionHours: null,
    turnaroundHoursTotal: 0,
    turnaroundCount: 0,
  };
}

function finish(row: Mutable): AnalyticsRollup {
  return {
    key: row.key,
    label: row.label,
    shiftReportCompletion: metric(row.completed, row.eligible),
    onTimeCloseout: metric(row.onTimeCloseout, row.due),
    activityCoverage: metric(row.activityDueSatisfied, row.due),
    eosrOnlyCount: row.eosrOnly,
    incidentCount: row.incidentCount,
    incidentDistribution: [...row.incidentDistribution]
      .map(([key, count]) => {
        const [classification, severity] = key.split("\u0000");
        return { classification, severity, count };
      })
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.classification.localeCompare(b.classification) ||
          a.severity.localeCompare(b.severity),
      ),
    openExceptionCount: row.openExceptionCount,
    oldestOpenExceptionHours: row.oldestOpenExceptionHours,
    correctionTurnaroundHours: row.turnaroundCount
      ? Math.round((row.turnaroundHoursTotal / row.turnaroundCount) * 10) / 10
      : null,
  };
}

export function buildReportingAnalytics(
  sources: AnalyticsSources,
  scopeWide: boolean,
  filters: AnalyticsFilters,
  window: ReportingAnalytics["window"],
): ReportingAnalytics {
  const portfolio = create(
    "portfolio",
    scopeWide ? "Organization" : "Authorized portfolio",
  );
  const branches = new Map<string, Mutable>();
  const clients = new Map<string, Mutable>();
  const sites = new Map<string, Mutable>();
  const groups = (location: AnalyticsLocation) => {
    const branchKey = location.branchId ?? "unassigned-branch";
    const branch =
      branches.get(branchKey) ??
      create(branchKey, location.branchName ?? "No branch");
    const client =
      clients.get(location.clientId) ??
      create(location.clientId, location.clientName);
    const site =
      sites.get(location.siteId) ?? create(location.siteId, location.siteName);
    branches.set(branchKey, branch);
    clients.set(location.clientId, client);
    sites.set(location.siteId, site);
    return [portfolio, branch, client, site];
  };
  for (const source of sources.assignments)
    for (const target of groups(source)) {
      target.eligible += source.eligible;
      target.due += source.due;
      target.completed += source.completed;
      target.eosrOnly += source.eosrOnly;
      target.onTimeCloseout += source.onTimeCloseout;
      target.activitySatisfied += source.activitySatisfied;
      target.activityDueSatisfied += source.activityDueSatisfied;
    }
  for (const source of sources.incidents)
    for (const target of groups(source)) {
      target.incidentCount += source.count;
      const key = `${source.classification}\u0000${source.severity}`;
      target.incidentDistribution.set(
        key,
        (target.incidentDistribution.get(key) ?? 0) + source.count,
      );
    }
  for (const source of sources.exceptions)
    for (const target of groups(source)) {
      if (openStates.has(source.state)) {
        target.openExceptionCount += source.openCount;
        target.oldestOpenExceptionHours = Math.max(
          target.oldestOpenExceptionHours ?? 0,
          source.ageHours,
        );
      }
      target.turnaroundHoursTotal += source.turnaroundHours;
      target.turnaroundCount += source.turnaroundCount;
    }
  const ordered = (map: Map<string, Mutable>) =>
    [...map.values()]
      .map(finish)
      .sort(
        (a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key),
      );
  const allSites = ordered(sites);
  const offset = (filters.sitePage ?? 0) * 50;
  return {
    scopeLabel: scopeWide ? "Organization" : "Authorized portfolio",
    window,
    filters,
    portfolio: finish(portfolio),
    branches: ordered(branches),
    clients: ordered(clients),
    sites: allSites.slice(offset, offset + 50),
    displayedSites: Math.max(0, Math.min(allSites.length - offset, 50)),
    siteCount: allSites.length,
    hasMoreSites: allSites.length > offset + 50,
  };
}
