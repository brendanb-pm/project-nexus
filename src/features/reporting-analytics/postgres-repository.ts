import "server-only";

import { sql, type SQL } from "drizzle-orm";
import type { NexusDatabase } from "@/server/db/client";
import type {
  AnalyticsFilters,
  AnalyticsScope,
  AnalyticsSources,
} from "./contracts";

type Window = { startsAt: string; endsAt: string; asOf: string };

function scoped(scope: AnalyticsScope, filters: AnalyticsFilters): SQL {
  const allowed: SQL[] = [];
  if (scope.branchIds.length)
    allowed.push(
      sql`c.branch_id in (${sql.join(
        scope.branchIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    );
  if (scope.clientIds.length)
    allowed.push(
      sql`c.id in (${sql.join(
        scope.clientIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    );
  if (scope.siteIds.length)
    allowed.push(
      sql`s.id in (${sql.join(
        scope.siteIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    );
  const grant = scope.organizationWide
    ? sql`true`
    : allowed.length
      ? sql`(${sql.join(allowed, sql` or `)})`
      : sql`false`;
  return sql`c.organization_id = ${scope.organizationId}::uuid
    and ${grant}
    and ${filters.branchId ? sql`c.branch_id = ${filters.branchId}::uuid` : sql`true`}
    and ${filters.clientId ? sql`c.id = ${filters.clientId}::uuid` : sql`true`}
    and ${filters.siteId ? sql`s.id = ${filters.siteId}::uuid` : sql`true`}`;
}

const location = sql`s.id as "siteId", s.name as "siteName", s.timezone,
  c.id as "clientId", c.name as "clientName",
  c.branch_id as "branchId", b.name as "branchName"`;
const locationGroup = sql`s.id, s.name, s.timezone, c.id, c.name, c.branch_id, b.name`;
// This is a transfer safety bound, never a silent metric truncation. A larger
// portfolio must use a dedicated paged aggregate query before it can be shown.
const aggregateRowLimit = 10_000;

function rows<T>(result: { rows: unknown[] }): T[] {
  return result.rows as T[];
}

function numbers<T extends Record<string, unknown>>(
  values: T[],
  fields: readonly (keyof T)[],
): T[] {
  return values.map((value) => {
    const copy = { ...value };
    for (const field of fields)
      copy[field] = Number(value[field]) as T[keyof T];
    return copy;
  });
}

export class PostgresReportingAnalyticsRepository {
  constructor(private readonly database: NexusDatabase) {}

  async load(
    scope: AnalyticsScope,
    filters: AnalyticsFilters,
    window: Window,
  ): Promise<AnalyticsSources> {
    const predicate = scoped(scope, filters);
    const start = new Date(window.startsAt);
    const end = new Date(window.endsAt);
    const asOf = new Date(window.asOf);
    // Each query is read-only and groups before returning; no exception
    // reconciliation or raw narrative/history read is part of analytics.
    const [assignmentResult, incidentResult, exceptionResult] =
      await Promise.all([
        this.database.execute(sql`
        with eligible as (
          select ${location}, sa.id as assignment_id,
            coalesce((select max(ce.effective_at) from clock_events ce
              where ce.shift_assignment_id = sa.id and ce.event_type = 'CLOCK_OUT'),
              sh.scheduled_end) as effective_end,
            (select min(e.submitted_at) from end_of_shift_reports e
              where e.shift_assignment_id = sa.id) as eosr_at,
            exists(select 1 from activity_entries a
              where a.shift_assignment_id = sa.id and a.status = 'SUBMITTED') as has_activity
          from shift_assignments sa
          join shifts sh on sh.id = sa.shift_id
          join posts p on p.id = sh.post_id
          join sites s on s.id = p.site_id
          join clients c on c.id = s.client_id
          left join branches b on b.id = c.branch_id and b.organization_id = c.organization_id
          where ${predicate}
            and sa.status <> 'cancelled'
            and ((sh.scheduled_end >= ${start} and sh.scheduled_end < ${end})
              or exists(select 1 from clock_events ce
                where ce.shift_assignment_id = sa.id and ce.event_type = 'CLOCK_OUT'
                  and ce.effective_at >= ${start} and ce.effective_at < ${end}))
            and (exists(select 1 from clock_events ce
              where ce.shift_assignment_id = sa.id and ce.event_type = 'CLOCK_IN')
              or exists(select 1 from time_records tr
                where tr.shift_assignment_id = sa.id and tr.status = 'APPROVED'
                  and (coalesce(tr.seconds_worked, 0) > 0 or coalesce(tr.minutes_worked, 0) > 0)))
        )
        select "siteId", "siteName", timezone, "clientId", "clientName",
          "branchId", "branchName", count(*)::int as eligible,
          count(*) filter (where effective_end + interval '15 minutes' <= ${asOf})::int as due,
          count(*) filter (where eosr_at is not null and has_activity)::int as completed,
          count(*) filter (where eosr_at is not null)::int as "eosrOnly",
          count(*) filter (where eosr_at <= effective_end + interval '15 minutes'
            and effective_end + interval '15 minutes' <= ${asOf})::int as "onTimeCloseout",
          count(*) filter (where has_activity)::int as "activitySatisfied",
          count(*) filter (where has_activity and effective_end + interval '15 minutes' <= ${asOf})::int as "activityDueSatisfied"
        from eligible
        where effective_end >= ${start} and effective_end < ${end}
        group by "siteId", "siteName", timezone, "clientId", "clientName", "branchId", "branchName"
        limit ${aggregateRowLimit + 1}`),
        this.database.execute(sql`
        select ${location}, i.classification, i.severity, count(distinct i.id)::int as count
        from incident_reports i
        join sites s on s.id = i.site_id
        join clients c on c.id = s.client_id
        left join branches b on b.id = c.branch_id and b.organization_id = c.organization_id
        where ${predicate}
          and i.occurred_at >= ${start} and i.occurred_at < ${end}
          and i.status in ('SUBMITTED', 'ACKNOWLEDGED', 'APPROVED', 'AMENDED')
          and ${filters.incidentClassification ? sql`i.classification = ${filters.incidentClassification}` : sql`true`}
          and ${filters.incidentSeverity ? sql`i.severity = ${filters.incidentSeverity}` : sql`true`}
          and ${filters.incidentStatus ? sql`i.status = ${filters.incidentStatus}` : sql`true`}
        group by ${locationGroup}, i.classification, i.severity
        limit ${aggregateRowLimit + 1}`),
        this.database.execute(sql`
        select ${location}, re.state, count(distinct re.id)::int as count,
          count(*) filter (where re.state not in ('RESOLVED', 'WAIVED')
            and re.due_at >= ${start} and re.due_at < ${end})::int as "openCount",
          max(extract(epoch from (${asOf}::timestamptz - re.first_detected_at)) / 3600)
            filter (where re.state not in ('RESOLVED', 'WAIVED')
              and re.due_at >= ${start} and re.due_at < ${end}) as "ageHours",
          sum(extract(epoch from (re.resolved_at - re.corrected_at)) / 3600)
            filter (where re.state = 'RESOLVED' and re.corrected_at is not null
              and re.resolved_at >= ${start} and re.resolved_at < ${end}) as "turnaroundHours",
          count(*) filter (where re.state = 'RESOLVED' and re.corrected_at is not null
            and re.resolved_at >= ${start} and re.resolved_at < ${end})::int as "turnaroundCount"
        from reporting_exceptions re
        join shift_assignments sa on sa.id = re.shift_assignment_id
        join shifts sh on sh.id = sa.shift_id
        join posts p on p.id = sh.post_id
        join sites s on s.id = p.site_id
        join clients c on c.id = s.client_id
        left join branches b on b.id = c.branch_id and b.organization_id = c.organization_id
        where ${predicate} and re.organization_id = ${scope.organizationId}::uuid
          and ((re.due_at >= ${start} and re.due_at < ${end})
            or (re.resolved_at >= ${start} and re.resolved_at < ${end}))
        group by ${locationGroup}, re.state
        limit ${aggregateRowLimit + 1}`),
      ]);
    if (
      assignmentResult.rows.length > aggregateRowLimit ||
      incidentResult.rows.length > aggregateRowLimit ||
      exceptionResult.rows.length > aggregateRowLimit
    )
      throw new Error(
        "Reporting analytics aggregate exceeds read safety bound",
      );
    type Assignment = AnalyticsSources["assignments"][number];
    type Incident = AnalyticsSources["incidents"][number];
    type Exception = AnalyticsSources["exceptions"][number];
    return {
      assignments: numbers(rows<Assignment>(assignmentResult), [
        "eligible",
        "due",
        "completed",
        "eosrOnly",
        "onTimeCloseout",
        "activitySatisfied",
        "activityDueSatisfied",
      ]),
      incidents: numbers(rows<Incident>(incidentResult), ["count"]),
      exceptions: numbers(rows<Exception>(exceptionResult), [
        "count",
        "openCount",
        "ageHours",
        "turnaroundHours",
        "turnaroundCount",
      ]),
    };
  }
}
