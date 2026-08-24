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
