import { describe, expect, it } from "vitest";
import type { CoverageRequirement } from "@/features/coverage/contracts";
import { materializeCoverageOccurrences } from "@/features/coverage/occurrences";
import {
  buildOperationalScorecards,
  type ScorecardSources,
} from "@/features/operations/scorecards";

const window = {
  startsAt: "2026-09-01T00:00:00.000Z",
  endsAt: "2026-09-02T00:00:00.000Z",
  asOf: "2026-09-01T12:00:00.000Z",
};
const requirement = (
  overrides: Partial<CoverageRequirement> = {},
): CoverageRequirement => ({
  id: "req-1",
  postId: "post-1",
  siteId: "site-1",
  clientId: "client-1",
  branchId: "branch-1",
  timezone: "UTC",
  requiredCount: 1,
  weekdays: ["TUESDAY"],
  localStartTime: "08:00:00",
  localEndTime: "16:00:00",
  effectiveStart: "2026-01-01",
  active: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});
const base = (overrides: Partial<ScorecardSources> = {}): ScorecardSources => ({
  sites: [
    {
      id: "site-1",
      clientId: "client-1",
      branchId: "branch-1",
      name: "Alpha Site",
      timezone: "UTC",
    },
  ],
  posts: [{ id: "post-1", siteId: "site-1", name: "Lobby" }],
  requirements: [requirement()],
  assignments: [],
  incidents: [],
  ...overrides,
});

describe("NX4.6 operational scorecards", () => {
  it("calculates required, scheduled, actual, coverage, and half-open gaps", () => {
    const scorecard = buildOperationalScorecards(
      base({
        assignments: [
          {
            id: "a1",
            postId: "post-1",
            startsAt: "2026-09-01T08:00:00.000Z",
            endsAt: "2026-09-01T16:00:00.000Z",
            eosrId: "e1",
            clockOut: true,
            actualStartsAt: "2026-09-01T08:00:00.000Z",
            actualEndsAt: "2026-09-01T16:00:00.000Z",
            actualSeconds: 28800,
          },
        ],
      }),
      window,
    ).sites[0]!.posts[0]!;
    expect(scorecard.required.seconds).toBe(28800);
    expect(scorecard.scheduled.seconds).toBe(28800);
    expect(scorecard.actual.seconds).toBe(28800);
    expect(scorecard.coveragePercent).toBe(100);
    expect(scorecard.uncovered.seconds).toBe(0);
    expect(scorecard.currentGaps).toHaveLength(0);
    expect(scorecard.shiftClose).toEqual({
      due: 1,
      complete: 1,
      incomplete: 0,
    });
  });

  it("keeps zero-required and missing actual evidence explicitly unavailable", () => {
    const post = buildOperationalScorecards(base({ requirements: [] }), window)
      .sites[0]!.posts[0]!;
    expect(post.required).toMatchObject({
      seconds: null,
      sourceState: "UNAVAILABLE",
    });
    expect(post.actual).toMatchObject({
      seconds: null,
      sourceState: "UNAVAILABLE",
    });
    expect(post.coveragePercent).toBeNull();
    expect(post.status).toBe("NO_REQUIREMENT");
  });

  it("materializes overnight requirements with timezone and DST-aware instants", () => {
    const occurrences = materializeCoverageOccurrences(
      [
        requirement({
          timezone: "America/Los_Angeles",
          weekdays: ["SATURDAY"],
          localStartTime: "22:00:00",
          localEndTime: "06:00:00",
        }),
      ],
      "2026-10-31T00:00:00.000Z",
      "2026-11-02T18:00:00.000Z",
    );
    expect(occurrences).toHaveLength(1);
    expect(
      (new Date(occurrences[0]!.endsAt).valueOf() -
        new Date(occurrences[0]!.startsAt).valueOf()) /
        3600000,
    ).toBe(9);
  });

  it("distinguishes current and upcoming gaps", () => {
    const requirements = [
      requirement({
        id: "current",
        localStartTime: "08:00:00",
        localEndTime: "14:00:00",
      }),
      requirement({
        id: "future",
        localStartTime: "18:00:00",
        localEndTime: "20:00:00",
      }),
    ];
    const post = buildOperationalScorecards(base({ requirements }), window)
      .sites[0]!.posts[0]!;
    expect(post.currentGaps.map((gap) => gap.requirementId)).toEqual([
      "current",
    ]);
    expect(post.upcomingGaps.map((gap) => gap.requirementId)).toEqual([
      "future",
    ]);
    expect(post.status).toBe("CRITICAL");
  });

  it("reconciles Site totals to isolated Posts and orders critical status first", () => {
    const posts = [
      { id: "post-1", siteId: "site-1", name: "Lobby" },
      { id: "post-2", siteId: "site-1", name: "Gate" },
    ];
    const requirements = [
      requirement(),
      requirement({ id: "req-2", postId: "post-2" }),
    ];
    const assignments = [
      {
        id: "a1",
        postId: "post-1",
        startsAt: "2026-09-01T08:00:00.000Z",
        endsAt: "2026-09-01T16:00:00.000Z",
        clockOut: false,
      },
    ];
    const site = buildOperationalScorecards(
      base({ posts, requirements, assignments }),
      window,
    ).sites[0]!;
    expect(site.required.seconds).toBe(
      site.posts.reduce((sum, post) => sum + (post.required.seconds ?? 0), 0),
    );
    expect(site.scheduled.seconds).toBe(
      site.posts.reduce((sum, post) => sum + (post.scheduled.seconds ?? 0), 0),
    );
    expect(site.posts.map((post) => post.id)).toEqual(["post-2", "post-1"]);
    expect(site.posts[0]!.currentGaps).toHaveLength(1);
    expect(site.posts[1]!.currentGaps).toHaveLength(0);
  });

  it("projects close compliance, incidents, and canonical identity links", () => {
    const post = buildOperationalScorecards(
      base({
        assignments: [
          {
            id: "a1",
            postId: "post-1",
            startsAt: "2026-09-01T01:00:00.000Z",
            endsAt: "2026-09-01T02:00:00.000Z",
            eosrId: "e1",
            clockOut: true,
          },
          {
            id: "a2",
            postId: "post-1",
            startsAt: "2026-09-01T03:00:00.000Z",
            endsAt: "2026-09-01T04:00:00.000Z",
            clockOut: false,
          },
        ],
        incidents: [
          {
            id: "incident-1",
            siteId: "site-1",
            postId: "post-1",
            occurredAt: "2026-09-01T10:00:00.000Z",
          },
        ],
      }),
      window,
    ).sites[0]!.posts[0]!;
    expect(post.shiftClose).toEqual({ due: 2, complete: 1, incomplete: 1 });
    expect(post.incidentCount).toBe(1);
    expect(post.href).toBe("/operations/sites/site-1/posts/post-1");
    expect(post.latestIncidentHref).toBe(
      "/operations/records/incident/incident-1",
    );
  });

  it("excludes future-effective requirement history", () => {
    const post = buildOperationalScorecards(
      base({ requirements: [requirement({ effectiveStart: "2026-09-03" })] }),
      window,
    ).sites[0]!.posts[0]!;
    expect(post.required.seconds).toBeNull();
  });
});
