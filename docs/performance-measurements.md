# Sprint 1 Non-Production Performance Measurements

## Status

**PASS — measured 2026-08-24 in an isolated local PostgreSQL 16.15 runtime.**
No production resource, data, credential, or external identity provider was
used. These are non-production server/application measurements, not a claim
about production or end-user network latency.

## Measurement procedure

1. Provision an isolated PostgreSQL database and apply the checked-in Drizzle
   migrations.
2. Load the runner's deterministic synthetic fixture; do not use customer or
   production data. The fixture creates one organization and 35 branches,
   clients, sites, posts, employees, credentials, and certifications.
3. Establish a synthetic, server-side `ADMIN` principal through the shared
   request context. This exercises the real authorization and data-access
   boundaries without an external identity provider.
4. Set `NEXUS_PERFORMANCE_TELEMETRY=true` and run `npm run performance:run`
   with `DATABASE_URL` and `PERFORMANCE_OUTPUT`. Run one warm-up followed by
   at least 30 measured repetitions for each operation.
5. Capture the structured `nexus.performance` events and calculate p50/p95 by
   operation. Do not retain request/session identifiers or query parameters.
6. Record results in this table and compare them with
   [the performance guardrails](./performance.md).

## Required representative paths

| Path                             | Operation                                | Samples | Request p50 / p95 ms | Aggregate DB p50 / p95 ms | Queries | Slowest query max ms | Rows max | Errors | Status |
| -------------------------------- | ---------------------------------------- | ------: | -------------------: | ------------------------: | ------: | -------------------: | -------: | -----: | ------ |
| Organization / Branch admin      | `organization-admin.read`                |      30 |          0.69 / 1.11 |               0.79 / 1.27 |       2 |                 0.77 |       27 |      0 | PASS   |
| Client / Contract admin          | `client-admin.page`                      |      30 |          1.68 / 2.31 |               1.84 / 2.74 |       5 |                 1.01 |       64 |      0 | PASS   |
| Site / Post admin                | `site-admin.page`                        |      30 |          1.68 / 2.30 |               1.60 / 2.13 |       4 |                 2.18 |       63 |      0 | PASS   |
| Employee admin                   | `people-admin.page`                      |      30 |          1.71 / 1.98 |               2.34 / 2.74 |       4 |                 1.11 |       63 |      0 | PASS   |
| Credential / Certification admin | `compliance.page`                        |      30 |          1.38 / 2.17 |               1.24 / 2.12 |       4 |                 1.13 |       38 |      0 | PASS   |
| Organization / Branch admin      | `organization-admin.update-organization` |      30 |          1.00 / 1.31 |               0.70 / 0.91 |       5 |                 1.07 |        3 |      0 | PASS   |

The runner uses one local connection, a separately reported warm-up, and 30
measured repetitions per operation. Each page is bounded to its normal first
page; the fixture data is synthetic and non-sensitive. Aggregate database time
can exceed wall-clock request time when already-authorized independent reads
run in parallel.

The existing loading and pending UI states provide immediate acknowledgement;
this server/application harness does not measure a browser click or network
round trip. All measured server request p95 values are below `900 ms`, all
aggregate database p95 values are below the `400 ms` hard ceiling, and all
operations remain at or below five database round trips.

## Interpretation

Rows returned are available from PostgreSQL query results. Rows scanned are
not inferred from runtime telemetry: capture a sanitized `EXPLAIN (ANALYZE,
BUFFERS)` only when investigating a concrete measured regression. A failure of
the `400 ms` database ceiling, five-round-trip ceiling, or `900 ms` p95 must
identify the measured bottleneck and may receive only an evidence-backed,
low-risk correction before remeasurement.

The initial runtime pass found two measurement-bound defects: direct pool reads
were not counted when only checked-out clients were instrumented, and
PostgreSQL microsecond timestamps could reject an otherwise current optimistic
update whose JavaScript version token had millisecond precision. Pool query
delegation is now counted exactly once, and the optimistic predicate compares
millisecond-normalized timestamps. The remeasurement above has zero errors.
No speculative index, cache, schema, or infrastructure optimization was made.

## Sprint 1 closure

NX-1.1 through NX-1.5 are integrated with the shared authorization, tenancy,
audit, pagination, and performance foundations. The measured representative
Sprint 1 paths satisfy the applicable non-production server/application
budgets, so Sprint 1 performance acceptance is **PASS**. This result does not
substitute for future deployed-environment or end-user network measurements.
