# Sprint 1 Non-Production Performance Measurements

## Status

**NOT RUN — no non-production PostgreSQL instance or local `DATABASE_URL` was
available in the Sprint 1 closure workspace.** No production resource or data
was used as a substitute. This keeps Sprint 1 performance acceptance
**PARTIAL** until the following repeatable measurements are captured.

## Measurement procedure

1. Provision an isolated PostgreSQL database and apply the checked-in Drizzle
   migrations.
2. Load only the deterministic fictional Nexus seed data; do not use customer
   or production data.
3. Configure a non-production OIDC test identity with an active Nexus ADMIN
   membership for the seeded organization.
4. Set `NEXUS_PERFORMANCE_TELEMETRY=true` and run each named read/action at
   least 30 warm repetitions after one separately reported warm-up.
5. Capture the structured `nexus.performance` events and calculate p50/p95 by
   operation. Do not retain request/session identifiers or query parameters.
6. Record results in this table and compare them with
   [the performance guardrails](./performance.md).

## Required representative paths

| Path                             | Operation                 | Dataset/result boundary                    | Samples | p50 | p95 | DB duration | Query count | Status  |
| -------------------------------- | ------------------------- | ------------------------------------------ | ------: | --: | --: | ----------: | ----------: | ------- |
| Organization / Branch admin      | `organization-admin.read` | organization + first 25 branches           | NOT RUN |   — |   — |           — |           — | NOT RUN |
| Client / Contract admin          | `client-admin.page`       | first 25 clients + selected detail         | NOT RUN |   — |   — |           — |           — | NOT RUN |
| Site / Post admin                | `site-admin.page`         | first 25 sites + selected detail           | NOT RUN |   — |   — |           — |           — | NOT RUN |
| Employee admin                   | `people-admin.page`       | first 25 employees + selected detail       | NOT RUN |   — |   — |           — |           — | NOT RUN |
| Credential / Certification admin | `compliance.page`         | authorized employee list + selected detail | NOT RUN |   — |   — |           — |           — | NOT RUN |

Representative mutations are also instrumented for organization update, client
update, post update, employee update, and credential verification. Include a
bounded, non-destructive fixture action for each when its lifecycle needs a
performance baseline.

## Interpretation

Rows returned are available from PostgreSQL query results. Rows scanned are
not inferred from runtime telemetry: capture a sanitized `EXPLAIN (ANALYZE,
BUFFERS)` only when investigating a concrete measured regression. A failure of
the `400 ms` database ceiling, five-round-trip ceiling, or `900 ms` p95 must
identify the measured bottleneck and may receive only an evidence-backed,
low-risk correction before remeasurement.

## Sprint 2 non-production runtime closure

**Status: PASS — 2026-08-29.** Measurements used a temporary isolated local
PostgreSQL 17 cluster on a non-default port with 2 synthetic organizations, 2
users, 2 employees, 110 shifts/assignments, and 93 initial clock events. The
cluster was not connected to a production database or production data.

One warm-up preceded each path. Each result below contains 30 successful,
server-side samples; it does not represent browser, network, device, or user
perceived latency.

| Path                        | Request p50 / p95 |   DB p50 / p95 | Max queries | Result |
| --------------------------- | ----------------: | -------------: | ----------: | ------ |
| Shift list/read             |    1.26 / 1.66 ms | 0.97 / 1.19 ms |           1 | PASS   |
| Assignment list/read        |    1.93 / 2.40 ms | 1.59 / 2.10 ms |           1 | PASS   |
| Clock event creation        |    2.60 / 3.99 ms | 2.12 / 3.22 ms |           6 | PASS*  |
| Clock correction            |    3.66 / 5.12 ms | 2.74 / 3.87 ms |           8 | PASS*  |
| Time-record derivation/read |    1.87 / 2.45 ms | 1.50 / 1.95 ms |           4 | PASS   |
| Time approval               |    3.37 / 4.50 ms | 2.65 / 3.64 ms |          10 | PASS*  |

All request p95 values are below 900 ms and all DB p95 values are below the
400 ms hard ceiling. Read paths are single bounded queries and the derivation
path uses four bounded queries. The higher fixed counts on audited mutations
include transaction control plus required authorization/context, append-only
history, revision, and audit writes. They are constant across 30 samples and
show no N+1 behavior; they are an explicit, non-blocking audit-integrity
exception to the usual five-round-trip guideline.

Runtime checks also passed for tenant isolation, assignment overlap,
unavailability, self-only clocking, missing/inaccurate/out-of-radius location
exceptions, append-only corrections, approval separation, incomplete-pair
blocking, and exact-second overnight derivation.
