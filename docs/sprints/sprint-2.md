# Sprint 2 — Scheduling and timekeeping

**Status:** Reconstructed specification  
**Stories:** NX-2.1 through NX-2.5  
**Integrity marker:** `NX-SPRINT-2-SCHEDULING-TIMEKEEPING-V1`

## Outcome and boundaries

Sprint 2 provides timezone-aware shift scheduling, employee availability and assignment, privacy-bounded geofence clock events, append-only time corrections, and explicit time approval for V1 uniformed/static-site operations. Approved time is a billing-support input, not payroll, tax, or wage calculation.

Excluded are recurring schedule optimization, automatic meal or break deductions, automatic rounding, continuous GPS tracking, patrol, Executive Protection, payroll, tax, and Sprint 3 work.

## Shared integrity rules

- The authenticated server context supplies actor, organization, employee relationship, scope, and audit attribution. Browser identifiers are lookup hints only.
- Every read is organization-scoped, bounded, and ordered. Material mutations transact the business change and append-only audit evidence together.
- Optimistic concurrency rejects stale mutations. Historical clock events, corrections, approvals, and amendments are never overwritten.
- Authoritative timestamps are instants. The applicable IANA timezone is retained for operator context. Nonexistent spring-forward local times are rejected; fall-back ambiguous local times require an explicit offset/disambiguation. Overnight and cross-midnight intervals are valid.
- Operational telemetry contains aggregate timing, query count, row count, payload size, and outcome only—never tenant, actor, location, session, query text, or record data.

## NX-2.1 — Shift scheduling and staffing

A Shift belongs to one authoritative Post/Site/Client/Branch/Organization hierarchy and records scheduled start/end instants, timezone, staffing requirement, lifecycle status, and version timestamp. End must be after start and staffing must be positive. Lifecycle transitions are explicit and deny invalid transitions. A staffed shift cannot be cancelled or materially rescheduled while active assignments remain. Reads are capped at 100 and use stable time/ID ordering.

Scheduling mutations require `MANAGE_SHIFT_ASSIGNMENTS` within the resolved hierarchy and write audit evidence with the authoritative actor. `CLIENT_USER` cannot mutate schedules.

## NX-2.2 — Availability and shift assignments

Availability records are employee-owned declarations of `AVAILABLE` or `UNAVAILABLE` over a half-open interval `[start,end)`. Adjacent intervals do not overlap. An explicit unavailability overlapping a shift blocks assignment; absence of availability is `UNKNOWN` and produces a warning rather than a denial.

Assignment requires an active employee in the same tenant and authorized hierarchy. Active assignments for one employee may not overlap. The existing qualification evaluator checks Post requirements as of the shift date. Armed Posts require a current `armed_authorization`; this is a hard requirement. Assignment mutations are audited and concurrency protected.

## NX-2.3 — Geofence clock in and out

Clocking is self-only through the authoritative User→Employee relationship and an active assignment. The server supplies `occurredAt`; clients cannot select authoritative time or actor.

- Clock-in normal window: scheduled start minus 15 minutes through plus 15 minutes.
- Clock-out normal window: scheduled end minus 15 minutes through plus 30 minutes.
- Distance uses Haversine against the Site coordinate and configured radius, default 150 metres.
- Reported accuracy must be present and at most 100 metres. Accuracy never expands the configured radius.
- Missing, inaccurate, outside-geofence, or outside-window evidence preserves the event with `EXCEPTION_REQUIRED`; it is not silently discarded.

Each event stores only the single submitted location evidence needed to evaluate that event. Nexus performs no background or continuous location collection. Location values and tenant/identity data never enter performance telemetry.

## NX-2.4 — Clock exceptions and supervisor correction

Corrections require the dedicated `CORRECT_TIME` capability, authoritative scope, a non-empty reason, and optimistic concurrency. A correction appends an immutable revision containing original and corrected effective time plus who/when/what/why. The original event remains unchanged. A correction invalidates an applicable prior approval. A user who corrected the resulting time cannot approve that revision.

## NX-2.5 — Time approval

Time is derived at exact-second precision from authoritative effective clock/correction history. Multiple valid in/out pairs are supported. Pairing is chronological and rejects double-in, out-without-in, or an incomplete final pair until resolved. No rounding or automatic deductions occur.

Approval requires `APPROVE_TIME`, authoritative scope, a complete derived record, optimistic concurrency, and correction/approval separation. Approval is explicit and appends immutable audit/revision history. A stale or repeated approval is rejected; later correction creates a new unapproved revision.

## Performance expectations

- Collection reads default to 25 and cap at 100.
- Related data is loaded set-wise; query count must not scale with rows.
- Normal representative paths should use no more than five database round trips where practical.
- Add indexes only for demonstrated tenant/time, assignment/employee/time, and immutable-history access paths.
- Runtime PostgreSQL p50/p95 evidence is a separate closure gate after this branch is durably delivered.

## Acceptance and verification

Focused tests must cover story success and denial paths, cross-organization and cross-hierarchy forged identifiers, client-user mutation denial, eligibility and armed authorization, half-open overlap, unknown availability, DST/overnight/cross-midnight behavior, clock windows and Haversine evidence, append-only corrections, incomplete pairs, stale/double approval, and corrector/approver separation.

Final reconstruction gates are format, lint, typecheck, migration history, deterministic seed validation, production build, applicable UI tests, and existing E2E. No claim of browser/network latency may be made from server telemetry.
