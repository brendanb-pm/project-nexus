import type {
  OperationalPostScorecard,
  OperationalSiteScorecard,
  ScorecardMetric,
} from "@/features/operations/contracts";

const card = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
const statusStyle = {
  CRITICAL: "border-red-400/50 bg-red-400/10 text-red-100",
  ATTENTION: "border-amber-400/50 bg-amber-400/10 text-amber-100",
  UPCOMING: "border-sky-400/50 bg-sky-400/10 text-sky-100",
  HEALTHY: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  NO_REQUIREMENT: "border-white/15 text-[var(--text-muted)]",
} as const;

function hours(metric: ScorecardMetric) {
  if (metric.seconds === null) return "Unavailable";
  return `${(metric.seconds / 3600).toFixed(1)}h`;
}

function Metric({
  label,
  metric,
  percent,
}: {
  label: string;
  metric: ScorecardMetric;
  percent?: number | null;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 p-3">
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold">
        {percent === undefined
          ? hours(metric)
          : percent === null
            ? "Unavailable"
            : `${percent}%`}
      </dd>
      <dd className="mt-1 break-words text-xs text-[var(--text-muted)]">
        {metric.sourceState === "PARTIAL" ? "Partial · " : ""}
        {metric.sourceLabel}
      </dd>
    </div>
  );
}

export function PostScorecard({
  post,
  detail = false,
}: {
  post: OperationalPostScorecard;
  detail?: boolean;
}) {
  return (
    <article className={card} data-testid={`post-scorecard-${post.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            Post scorecard
          </p>
          <h3 className="mt-1 text-lg font-semibold">{post.name}</h3>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle[post.status]}`}
        >
          {post.status.replace("_", " ")}
        </span>
      </div>
      <dl
        className={`mt-4 grid gap-3 ${detail ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2"}`}
      >
        <Metric label="Required" metric={post.required} />
        <Metric label="Scheduled" metric={post.scheduled} />
        <Metric
          label="Coverage"
          metric={post.scheduled}
          percent={post.coveragePercent}
        />
        {detail ? (
          <>
            <Metric label="Actual worked" metric={post.actual} />
            <Metric label="Uncovered" metric={post.uncovered} />
          </>
        ) : null}
      </dl>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <p>
          <span className="text-[var(--text-muted)]">Staffed now</span>
          <br />
          <strong>
            {post.activeStaffing.assigned} / {post.activeStaffing.required}
          </strong>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Gaps</span>
          <br />
          <strong>
            {post.currentGaps.length} current · {post.upcomingGaps.length}{" "}
            upcoming
          </strong>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Shift close</span>
          <br />
          <strong>
            {post.shiftClose.complete} complete · {post.shiftClose.incomplete}{" "}
            incomplete
          </strong>
        </p>
      </div>
      {detail ? (
        <div className="mt-4 rounded-lg border border-white/10 p-3 text-sm">
          <p className="font-medium">Operational activity</p>
          <p className="mt-1 text-[var(--text-muted)]">
            {post.incidentCount} incident{post.incidentCount === 1 ? "" : "s"}{" "}
            in this scorecard window.
          </p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium underline">
        {!detail ? <a href={post.href}>Inspect Post scorecard</a> : null}
        <a href={post.schedulingHref}>Open canonical schedule</a>
        {post.latestIncidentHref ? (
          <a href={post.latestIncidentHref}>Open latest canonical Incident</a>
        ) : null}
      </div>
    </article>
  );
}

export function SiteScorecard({
  site,
  detail = false,
}: {
  site: OperationalSiteScorecard;
  detail?: boolean;
}) {
  return (
    <section className="grid gap-3" data-testid={`site-scorecard-${site.id}`}>
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Site scorecard · {site.timezone}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{site.name}</h2>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle[site.status]}`}
          >
            {site.status.replace("_", " ")}
          </span>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Required" metric={site.required} />
          <Metric label="Scheduled" metric={site.scheduled} />
          <Metric
            label="Coverage"
            metric={site.scheduled}
            percent={site.coveragePercent}
          />
          <Metric label="Actual worked" metric={site.actual} />
          <Metric label="Uncovered" metric={site.uncovered} />
        </dl>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <p>
            <span className="text-[var(--text-muted)]">Coverage gaps</span>
            <br />
            <strong>
              {site.currentGapCount} current · {site.upcomingGapCount} upcoming
            </strong>
          </p>
          <p>
            <span className="text-[var(--text-muted)]">Shift close</span>
            <br />
            <strong>
              {site.shiftClose.complete} complete · {site.shiftClose.incomplete}{" "}
              incomplete
            </strong>
          </p>
          <p>
            <span className="text-[var(--text-muted)]">Incidents</span>
            <br />
            <strong>{site.incidentCount}</strong>
          </p>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Required coverage comes from CoverageRequirement. Separate contracted
          hours are not represented in the canonical model.
        </p>
        {!detail ? (
          <a
            className="mt-4 inline-block min-h-11 py-2 text-sm font-medium underline"
            href={site.href}
          >
            Inspect Site and Posts
          </a>
        ) : null}
      </div>
      {detail
        ? site.posts.map((post) => <PostScorecard key={post.id} post={post} />)
        : null}
    </section>
  );
}

export function ScorecardUnavailable() {
  return (
    <section className={card} role="alert">
      <h1 className="text-xl font-semibold">
        Operational scorecard unavailable
      </h1>
      <p className="mt-2 text-[var(--text-muted)]">
        This Site or Post is unavailable in your authorized scope.
      </p>
      <a href="/operations" className="mt-4 inline-block underline">
        Return to Operations
      </a>
    </section>
  );
}
