# Performance Architecture and Guardrails

Performance is a feature requirement; it never permits weaker authorization,
tenancy, auditability, correctness, or recovery behavior.

## Interaction budgets

| Boundary                       |                Target |
| ------------------------------ | --------------------: |
| Immediate acknowledgement      |           `<= 100 ms` |
| Meaningful authorized content  |           `<= 500 ms` |
| Complete interaction           |       `p95 <= 900 ms` |
| Normal aggregate database work |          `150-250 ms` |
| Database hard ceiling          |           `<= 400 ms` |
| Normal database round trips    | `<= 5` (prefer `1-3`) |

Measurements must name their environment, dataset, operation, sample count,
and warm/cold condition. They are not production claims unless measured in a
production-approved environment. Cold starts, compilation, migrations, bulk
work, and external-provider time must be reported separately.

## Required request and data-access shape

1. Resolve the authenticated principal and authoritative scope.
2. Establish the request correlation and timing context.
3. Authorize the capability and hierarchical resource scope centrally.
4. Execute bounded, tenant-scoped persistence work.
5. Return only the fields authorized for that boundary.
6. Record safe aggregate timing, query-count, row-count, and outcome data.

Client-supplied tenant, role, capability, or scope values are lookup hints at
most. They never authorize a query. Queries must retain their trusted
organization and applicable branch/client/site/employee/visibility predicates;
fetching a global result and filtering it in memory is prohibited.

## Data-access rules

- User-facing collections require a server-enforced page maximum and stable
  ordering. Use cursor pagination for large or changing collections.
- N+1 queries are prohibited. Query count must remain constant as a bounded
  collection grows; use set-oriented joins, bounded batches, or projections.
- Parallelize only independent, already-authorized reads. Preserve atomic
  transactions for writes and their audit events.
- Select only boundary-required fields. Lazy-load narratives, history, and
  attachments that are not needed for meaningful initial content.
- Add indexes only for measured query shapes, beginning with tenant equality
  predicates followed by narrower scope and sort columns. Do not add
  speculative indexes.
- Do not introduce cross-tenant or cross-request caches without an explicit,
  permission-safe key and separate architecture decision.

## Safe instrumentation

`src/server/performance/telemetry.ts` is the shared server-only measurement
boundary. The `pg` connection client is instrumented once by
`src/server/db/client.ts`, so Drizzle reads, writes, and transaction statements
are counted without repository-specific logging. Representative Sprint 1 page
and mutation boundaries use `measureRequest`/`measureServerAction`.

Instrumentation is opt-in: set `NEXUS_PERFORMANCE_TELEMETRY=true` only in a
controlled non-production environment. It emits a structured aggregate event
containing an operation name, duration, aggregate DB duration, query count,
slowest-query duration, returned-row count, estimated serialized boundary
payload size where available, and outcome. It never emits SQL text, SQL
parameters, actor, tenant, request/session IDs, tokens, response data, or
other secrets. PostgreSQL rows scanned are not collected because doing so
requires invasive plan instrumentation; use sanitized `EXPLAIN (ANALYZE,
BUFFERS)` separately when an index decision needs it.

## Regression measurement

For each changed interactive path, record a seeded non-production baseline:

- route/action and its acknowledgement/meaningful/complete boundary;
- dataset size and tenant/scope shape;
- sample count, warm/cold condition, p50 and p95 request duration;
- aggregate database duration, query count, slowest query, and returned rows;
- payload size when the boundary can estimate it; and
- PASS, FAIL, or NOT RUN for every applicable budget.

Timing assertions belong in a controlled integration/performance job rather
than machine-speed-sensitive unit tests. Unit tests should instead prove
bounded results, constant query count, trusted tenant predicates, stable
pagination, and safe telemetry behavior.

## Acceptance checklist

1. The interaction has immediate acknowledgement, meaningful-content, and
   complete-interaction boundaries.
2. It uses bounded data access and `<= 5` normal round trips with no N+1 path.
3. Aggregate database time is within the stated target/ceiling for the named
   environment.
4. Complete interaction p95 is `<= 900 ms`, or an evidence-backed exception
   and follow-up are explicit.
5. Telemetry contains no sensitive values and does not weaken authorization or
   tenant isolation.
