# Performance Architecture and Guardrails

## Purpose

This document defines the minimum performance design and measurable acceptance guidance for Project Nexus Sprint 1 and later work. Performance is a feature requirement, not permission to weaken authorization, tenancy, auditability, correctness, or recovery behavior.

These guardrails apply to user-facing server interactions and their supporting database work. They are targets for representative development and test data, not unsupported claims about production capacity. A story must measure the paths it implements; this preflight does not optimize paths that do not yet exist.

## Interaction budgets

| Budget                    |              Target | Measurement boundary                                                                                       |
| ------------------------- | ------------------: | ---------------------------------------------------------------------------------------------------------- |
| Immediate acknowledgement |         `<= 100 ms` | User input to visible pressed, pending, optimistic, or loading feedback                                    |
| Meaningful content        |         `<= 500 ms` | User input/navigation to the first useful, authorized content or actionable result                         |
| Complete interaction      |     `p95 <= 900 ms` | User input to stable completion for the named interaction, excluding explicitly asynchronous external work |
| Normal database work      | `150-250 ms` target | Aggregate database elapsed time for one normal interaction                                                 |
| Database hard ceiling     |         `<= 400 ms` | Aggregate database elapsed time for one normal interaction                                                 |
| Database round trips      |              `<= 5` | Queries and transaction statements issued by one normal interaction; prefer `1-3`                          |

A story must name the interaction and measurement environment when reporting these budgets. Cold starts, local development compilation, migrations, bulk exports, and external-provider work must be reported separately rather than hidden inside or excluded from a normal-path result without explanation.

The `400 ms` database ceiling is an acceptance limit, not a timeout recommendation. Any exception requires measured evidence, an explicit reason, bounded input, and a follow-up decision; it must not silently redefine a normal interaction.

## Required request shape

### Server boundary

Next.js Server Components remain the default for reads that compose a route. Route handlers and server actions may support interactive mutations and incremental reads when appropriate. Persistence remains server-only.

Every request must follow this order:

1. Resolve the authenticated principal and authoritative tenant/scope context.
2. Establish a request correlation identifier and timing context.
3. Authorize the required capability and target scope using centralized authorization.
4. Execute bounded, tenant-scoped database work.
5. Return a boundary-specific response containing only authorized fields.
6. Record duration, query count, outcome, and safe route/operation metadata.

The browser may supply search terms, cursors, and record identifiers as lookup hints. It never supplies authoritative organization, branch, client, site, employee, role, capability, or visibility scope.

### Security is part of the query plan

Queries must include the trusted organization predicate and applicable branch, client, site, employee, and visibility predicates. Fetching a global result set and filtering unauthorized records in memory or in the browser is prohibited.

Performance work must not:

- cache or reuse a result without a tenant- and permission-safe key;
- skip centralized authorization to save a query;
- return unauthorized rows for later presentation filtering;
- expose hidden fields through a broad projection;
- trust client-supplied scope to narrow a query;
- bypass audit or revision requirements for mutations; or
- combine tenants in a read model unless isolation remains explicit and enforceable.

Fail-closed authorization remains required when identity, scope, or visibility cannot be resolved. A denied request should avoid unnecessary domain queries after the authoritative denial can be made.

## Data-access rules

### Bounded result sets

Every collection query must have an explicit maximum result count. An unbounded `.select()` for a user-facing collection is not acceptable. Default and maximum page sizes belong in the story/API contract and must be enforced server-side.

Prefer cursor pagination using a stable, deterministic order and unique tie-breaker. Offset pagination is acceptable only for demonstrably small administrative datasets or where its consistency and cost tradeoff are documented. Search input must be length-bounded and large directories must use server-side search.

Detail requests should select only fields required by the boundary contract. Large narratives, audit history, attachments, and secondary panels should use lazy hydration when they are not needed for the initial meaningful view.

### N+1 prohibition

Per-row database queries inside a collection loop are prohibited. Reviews and tests must examine query count as the result size grows. A list returning 1, 10, or 50 items should retain a constant query count unless a documented bounded batching strategy requires otherwise.

Use, in order of preference:

1. a set-oriented join or purpose-built projection;
2. a second query using the bounded parent-ID set, followed by server-side assembly;
3. a bounded batch loader within one request when the first two options would create materially worse complexity.

A request-scoped batch loader must include tenant/scope in its key and must not become a cross-request authorization cache.

### Batching and parallel reads

Batch dependent writes in one transaction when atomicity and audit behavior require it. Bulk operations must have explicit item and payload limits and must report partial-success semantics if they cannot be atomic.

Independent, already-authorized reads may execute in parallel when doing so reduces critical-path latency without exceeding the database connection budget. Dependent reads remain sequential. Do not parallelize several queries merely to disguise an avoidable round-trip or N+1 design.

### Purpose-built read models

Interactive list and detail views may use typed, purpose-built query functions or projections that return only the fields the UI requires. These are read boundaries, not duplicate sources of business truth. Canonical writes continue through normalized domain/service logic and the existing audit/revision model.

Create a materialized view, denormalized table, search service, or asynchronous projection only after measurements show that a normal set-oriented PostgreSQL query cannot meet the budget. Such infrastructure is a material architecture decision requiring its own story, consistency contract, tenant-isolation design, failure/rebuild plan, and ADR.

## Index strategy

Indexes must follow real query shapes. For each new list, lookup, or authorization path, document:

- equality predicates, beginning with `organization_id` when stored directly;
- narrower branch/client/site/employee scope predicates;
- status or visibility predicates used consistently;
- sort columns and the stable unique tie-breaker;
- foreign-key joins; and
- uniqueness constraints that enforce tenant-safe business keys.

Composite index column order should match equality filters first and range/sort columns afterward. Partial indexes may support common active-record paths when their benefit is measured and inactive/history access remains correct.

Do not add speculative indexes for every column. Each added index increases write, migration, and storage cost. A story that adds or changes an index must identify the query it supports and capture `EXPLAIN (ANALYZE, BUFFERS)` evidence against representative non-production data when feasible. Production execution plans must not be collected with sensitive values in logs.

Existing Sprint 0B indexes are a foundation, not proof that future access paths are covered. Sprint 1 list/search designs must review composite tenant-and-sort indexes after their final predicates and ordering are known.

## UI loading and hydration

Every interaction must acknowledge input within `100 ms`; never leave an operator wondering whether an action registered. Use immediate control state, a pending indicator, skeleton, or progress state appropriate to the action. Acknowledgement must not imply successful persistence.

Prefer server-rendered meaningful content and stream independent secondary regions when the route benefits. Keep client components and initial client payloads limited to interactive areas. Do not download a complete directory to implement a picker or client-side pagination.

Use pagination or incremental loading for collections. Lazy-hydrate expensive secondary content such as long histories or attachment metadata. Loading, empty, permission, validation, stale-data, transient-error, uncertain-outcome, and retry states remain required; a faster happy path does not make an unstable failure path acceptable.

Optimistic updates are allowed only when rollback/reconciliation is clear and authorization has not been assumed by the client. Consequential or uncertain mutations must reconcile authoritative server state before retry and must not duplicate audit events.

## Instrumentation contract

Future server data-access work must provide one shared, server-only measurement boundary rather than ad hoc logging in each repository. At minimum, capture:

- request/correlation ID;
- stable route or operation name, never a raw URL containing identifiers;
- total server duration;
- aggregate database duration;
- database round-trip count;
- response outcome/status class;
- returned row count or page size where useful;
- cache status if caching is later approved; and
- a slow-request/slow-query classification against these budgets.

Instrumentation must use structured events, monotonic timing, and parameterized-query metadata. It must not record secrets, credentials, raw SQL parameter values, report narratives, personal contact data, precise location, attachment contents, or unrestricted entity snapshots. Tenant identifiers should be omitted, irreversibly transformed, or access-controlled according to the future observability threat model.

Query instrumentation should be added at the shared database adapter/client boundary once a runtime connection module is implemented. Request instrumentation belongs at the shared authenticated server entry boundary. These placements keep measurements comprehensive without requiring each repository to invent wrappers.

No observability vendor, production retention policy, sampling policy, or alerting service is selected by this document.

## Regression measurement

Each Sprint 1+ story that creates or materially changes a user interaction must define at least one representative performance scenario and record:

- fixture/data volume and tenant/scope shape;
- warm or cold condition;
- total duration distribution, including p50 and p95 when repeatable;
- database duration and round-trip count;
- returned row count/page size;
- the tool and command used; and
- PASS, FAIL, NOT RUN, or NOT APPLICABLE for each relevant budget.

Automated tests should assert deterministic properties first: maximum page size, bounded payload behavior, tenant predicates, stable pagination, and constant query count as result size grows. Timing tests may run in a controlled integration/performance job when stable enough; they should not become flaky unit tests tied to arbitrary developer-machine speed.

Record a baseline when a path first becomes runnable. Compare later measurements using the same fixture and environment. Treat a material regression in p95, database time, query count, or payload size as a review finding even if the hard ceiling still passes.

Production telemetry may validate real performance later, but local or CI evidence remains required before release. Never use production customer data to construct a performance fixture.

## Story acceptance checklist

For every applicable Sprint 1+ interaction:

1. The story names its immediate acknowledgement, meaningful-content, and complete-interaction boundaries.
2. Collection inputs and outputs are bounded; pagination and stable ordering are explicit.
3. The query plan includes authoritative tenant and authorization scope.
4. Query count is `<= 5`, preferably `1-3`, and does not grow per returned row.
5. Aggregate normal-path database time targets `150-250 ms` and does not exceed `400 ms` in the stated environment.
6. The complete interaction demonstrates `p95 <= 900 ms`, or the exception and remediation story are explicit.
7. The UI acknowledges input within `100 ms` and exposes meaningful content within `500 ms` under the stated conditions.
8. Required indexes map to measured query shapes; speculative indexes are excluded.
9. Independent reads are parallelized only when safe and beneficial; required transactions remain atomic.
10. Instrumentation reports safe request and query measurements without sensitive values.
11. Loading and failure states preserve correctness, retry safety, and authoritative tenant context.
12. The PR reports measurement evidence, limitations, architectural drift, and follow-up work.

## Current baseline and future work

Sprint 0B already establishes PostgreSQL/Drizzle, normalized tenant-aware models, centralized authorization, server-only persistence, and initial foreign-key/scope indexes. The bootstrap has no implemented feature data paths to optimize and no runtime database adapter, request instrumentation, query instrumentation, pagination contract, or production observability system.

Therefore this preflight changes documentation only. Future stories must implement performance support when a measured path exists. The following architectural implications require scoped future work:

1. Establish the shared authenticated request boundary and server-only Drizzle database adapter before feature repositories proliferate.
2. Add safe request/query timing and round-trip counting at those shared boundaries.
3. Define reusable cursor/page contracts and server-enforced page-size limits for Sprint 1 administrative collections.
4. Review and migrate composite indexes after Sprint 1 query predicates and sort orders are final.
5. Add a repeatable non-production performance fixture/harness and CI policy before timing regressions can become a reliable gate.
6. Decide observability storage, access, sampling, retention, and identifier-handling policy before production telemetry is enabled.

None of these decisions authorizes a second authorization mechanism, cross-tenant caching, a denormalized write model, or a paid external dependency.
