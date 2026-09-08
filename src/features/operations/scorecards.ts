import type { CoverageRequirement } from "@/features/coverage/contracts";
import {
  capacitySeconds,
  materializeCoverageOccurrences,
  uncoveredSegments,
} from "@/features/coverage/occurrences";
import type {
  OperationalPostScorecard,
  OperationalScorecards,
  OperationalSiteScorecard,
  ScorecardMetric,
} from "./contracts";

export type ScorecardSiteRow = {
  id: string;
  clientId: string;
  branchId: string;
  name: string;
  timezone: string;
};
export type ScorecardPostRow = { id: string; siteId: string; name: string };
export type ScorecardAssignmentRow = {
  id: string;
  postId: string;
  startsAt: string;
  endsAt: string;
  eosrId?: string;
  clockOut: boolean;
  actualStartsAt?: string;
  actualEndsAt?: string;
  actualSeconds?: number;
};
export type ScorecardIncidentRow = {
  id: string;
  siteId: string;
  postId?: string;
  occurredAt: string;
};
export type ScorecardSources = {
  sites: readonly ScorecardSiteRow[];
  posts: readonly ScorecardPostRow[];
  requirements: readonly CoverageRequirement[];
  assignments: readonly ScorecardAssignmentRow[];
  incidents: readonly ScorecardIncidentRow[];
};

const metric = (
  seconds: number | null,
  sourceState: ScorecardMetric["sourceState"],
  sourceLabel: string,
): ScorecardMetric => ({ seconds, sourceState, sourceLabel });
const addClose = (items: readonly OperationalPostScorecard[]) =>
  items.reduce(
    (v, p) => ({
      due: v.due + p.shiftClose.due,
      complete: v.complete + p.shiftClose.complete,
      incomplete: v.incomplete + p.shiftClose.incomplete,
    }),
    { due: 0, complete: 0, incomplete: 0 },
  );
const statusRank = {
  CRITICAL: 0,
  ATTENTION: 1,
  UPCOMING: 2,
  HEALTHY: 3,
  NO_REQUIREMENT: 4,
} as const;

export function buildOperationalScorecards(
  sources: ScorecardSources,
  window: OperationalScorecards["window"],
): OperationalScorecards {
  const occurrences = materializeCoverageOccurrences(
    sources.requirements,
    window.startsAt,
    window.endsAt,
  );
  const now = new Date(window.asOf).valueOf();
  const posts = sources.posts
    .map((post): OperationalPostScorecard => {
      const required = occurrences.filter((o) => o.postId === post.id);
      const assignments = sources.assignments.filter(
        (a) => a.postId === post.id,
      );
      const requiredSeconds = required.reduce(
        (sum, o) =>
          sum +
          ((new Date(o.endsAt).valueOf() - new Date(o.startsAt).valueOf()) /
            1000) *
            o.requiredCount,
        0,
      );
      const gapRows = required.map((o) => {
        const covered = capacitySeconds(
          o.startsAt,
          o.endsAt,
          o.requiredCount,
          assignments,
        );
        const total =
          ((new Date(o.endsAt).valueOf() - new Date(o.startsAt).valueOf()) /
            1000) *
          o.requiredCount;
        return {
          occurrence: o,
          covered,
          uncovered: Math.max(0, total - covered),
          segments: uncoveredSegments(
            o.startsAt,
            o.endsAt,
            o.requiredCount,
            assignments,
          ),
        };
      });
      const scheduledSeconds = gapRows.reduce((sum, g) => sum + g.covered, 0);
      const gaps = gapRows.flatMap((g) =>
        g.segments
          .filter((segment) => new Date(segment.endsAt).valueOf() > now)
          .map((segment) => ({
            requirementId: g.occurrence.requirementId,
            ...segment,
            state:
              new Date(segment.startsAt).valueOf() <= now
                ? ("CURRENT" as const)
                : ("UPCOMING" as const),
          })),
      );
      const actualRows = assignments.filter(
        (a) =>
          a.actualStartsAt &&
          a.actualEndsAt &&
          a.actualSeconds !== undefined &&
          new Date(a.actualStartsAt).valueOf() <
            new Date(window.endsAt).valueOf() &&
          new Date(a.actualEndsAt).valueOf() >
            new Date(window.startsAt).valueOf(),
      );
      const actualSeconds = actualRows.reduce((sum, a) => {
        const recordStart = new Date(a.actualStartsAt!).valueOf();
        const recordEnd = new Date(a.actualEndsAt!).valueOf();
        const overlapStart = Math.max(
          recordStart,
          new Date(window.startsAt).valueOf(),
        );
        const overlapEnd = Math.min(
          recordEnd,
          new Date(window.endsAt).valueOf(),
        );
        const ratio =
          recordEnd > recordStart
            ? (overlapEnd - overlapStart) / (recordEnd - recordStart)
            : 0;
        return sum + Math.round((a.actualSeconds ?? 0) * ratio);
      }, 0);
      const ended = assignments.filter(
        (a) =>
          new Date(a.endsAt).valueOf() <= now ||
          Boolean(a.eosrId) ||
          a.clockOut,
      );
      const complete = ended.filter((a) => a.eosrId && a.clockOut).length;
      const currentRequirement = required
        .filter(
          (o) =>
            new Date(o.startsAt).valueOf() <= now &&
            new Date(o.endsAt).valueOf() > now,
        )
        .reduce((sum, o) => sum + o.requiredCount, 0);
      const activeAssigned = assignments.filter(
        (a) =>
          new Date(a.startsAt).valueOf() <= now &&
          new Date(a.endsAt).valueOf() > now,
      ).length;
      const incidents = sources.incidents.filter((i) => i.postId === post.id);
      const currentGaps = gaps.filter((g) => g.state === "CURRENT");
      const upcomingGaps = gaps.filter((g) => g.state === "UPCOMING");
      const status = !required.length
        ? "NO_REQUIREMENT"
        : currentGaps.length
          ? "CRITICAL"
          : ended.length > complete
            ? "ATTENTION"
            : upcomingGaps.length
              ? "UPCOMING"
              : "HEALTHY";
      return {
        id: post.id,
        siteId: post.siteId,
        name: post.name,
        status,
        required: required.length
          ? metric(
              Math.round(requiredSeconds),
              "AVAILABLE",
              "CoverageRequirement-derived required coverage",
            )
          : metric(
              null,
              "UNAVAILABLE",
              "No CoverageRequirement in this window",
            ),
        scheduled: required.length
          ? metric(
              Math.round(scheduledSeconds),
              "AVAILABLE",
              "Published/completed assigned shifts within required intervals",
            )
          : metric(
              null,
              "UNAVAILABLE",
              "No CoverageRequirement for comparison",
            ),
        actual: actualRows.length
          ? metric(
              actualSeconds,
              actualRows.length <
                assignments.filter((a) => new Date(a.startsAt).valueOf() < now)
                  .length
                ? "PARTIAL"
                : "AVAILABLE",
              "Authoritative TimeRecords",
            )
          : metric(
              null,
              "UNAVAILABLE",
              "No authoritative TimeRecord in this window",
            ),
        coveragePercent:
          requiredSeconds > 0
            ? Math.round((scheduledSeconds / requiredSeconds) * 1000) / 10
            : null,
        uncovered: required.length
          ? metric(
              Math.round(requiredSeconds - scheduledSeconds),
              "AVAILABLE",
              "CoverageRequirement intervals minus assigned schedule",
            )
          : metric(
              null,
              "UNAVAILABLE",
              "No CoverageRequirement for gap calculation",
            ),
        currentGaps,
        upcomingGaps,
        activeStaffing: {
          required: currentRequirement,
          assigned: activeAssigned,
        },
        shiftClose: {
          due: ended.length,
          complete,
          incomplete: ended.length - complete,
        },
        incidentCount: incidents.length,
        ...(incidents[0]
          ? {
              latestIncidentHref: `/operations/records/incident/${incidents[0].id}`,
            }
          : {}),
        schedulingHref: `/admin/scheduling?postId=${post.id}`,
        href: `/operations/sites/${post.siteId}/posts/${post.id}`,
      };
    })
    .sort(
      (a, b) =>
        statusRank[a.status] - statusRank[b.status] ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );

  const sites = sources.sites
    .map((site): OperationalSiteScorecard => {
      const children = posts.filter((post) => post.siteId === site.id);
      const sum = (key: "required" | "scheduled" | "actual" | "uncovered") =>
        children.reduce((total, post) => total + (post[key].seconds ?? 0), 0);
      const state = (key: "required" | "scheduled" | "actual" | "uncovered") =>
        children.every((p) => p[key].sourceState === "UNAVAILABLE")
          ? ("UNAVAILABLE" as const)
          : children.some((p) => p[key].sourceState !== "AVAILABLE")
            ? ("PARTIAL" as const)
            : ("AVAILABLE" as const);
      const required = sum("required");
      const scheduled = sum("scheduled");
      const actualState = state("actual");
      const siteIncidentCount = sources.incidents.filter(
        (incident) => incident.siteId === site.id,
      ).length;
      return {
        id: site.id,
        clientId: site.clientId,
        branchId: site.branchId,
        name: site.name,
        timezone: site.timezone,
        status: children[0]?.status ?? "NO_REQUIREMENT",
        required: metric(
          required || null,
          state("required"),
          "Sum of Post CoverageRequirement-derived hours",
        ),
        scheduled: metric(
          scheduled || (required ? 0 : null),
          state("scheduled"),
          "Sum of Post coverage-aligned assigned schedule",
        ),
        actual: metric(
          actualState === "UNAVAILABLE" ? null : sum("actual"),
          actualState,
          "Sum of authoritative Post TimeRecords",
        ),
        coveragePercent: required
          ? Math.round((scheduled / required) * 1000) / 10
          : null,
        uncovered: metric(
          required ? sum("uncovered") : null,
          state("uncovered"),
          "Sum of Post uncovered required coverage",
        ),
        currentGapCount: children.reduce((n, p) => n + p.currentGaps.length, 0),
        upcomingGapCount: children.reduce(
          (n, p) => n + p.upcomingGaps.length,
          0,
        ),
        shiftClose: addClose(children),
        incidentCount: siteIncidentCount,
        posts: children,
        href: `/operations/sites/${site.id}`,
      };
    })
    .sort(
      (a, b) =>
        statusRank[a.status] - statusRank[b.status] ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
  return { window, sites };
}
