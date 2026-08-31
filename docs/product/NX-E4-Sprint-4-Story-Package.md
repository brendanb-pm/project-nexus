# NX-E4 — Sprint 4 Story Package

**Status:** Approved for engineering planning.
**Product decisions incorporated:** PO-DEC-E4-01 (EOSR with passdown section) and PO-DEC-E4-02 (weekly CoverageRequirement recurrence only).

## Epic boundary

NX-E4 delivers an exception-driven Operations Center and the minimum coverage domain needed to identify required, scheduled, and uncovered work. It also introduces a canonical EOSR with a passdown section surfaced to the relevant incoming Guard. It does not implement complex recurrence, availability redesign, compliance policy expansion, payroll, billing, configurable reporting, AI, or open-shift claiming.

All stories use the authenticated request boundary, centralized capabilities, authoritative tenant/hierarchy derivation, bounded/stable reads, append-only audit for material mutations, optimistic concurrency where mutable state exists, and no client-selected identifier as authority.

## NX4.1 — Operations exception contract and capability boundary

**Purpose / primary user:** Give Operations a bounded, authorized source of actionable exceptions.

**Product behavior:** Derive deterministic cards from canonical shifts, assignments, clock/time evidence, incidents, EOSR/passdown and coverage data. Cards show severity, age, site/post, permitted person context, source link, and one allowed action.

**In scope:** Exception taxonomy, aggregate service/repository contract, stable filters/cursors, source links, role/capability boundary. **Out of scope:** New source records, ownership workflow, AI ranking.

**Business/data/read-model rules:** Source records remain authoritative; derived exceptions are never a competing mutable record; DTOs expose only scoped fields; no N+1 reads; severity is documented/deterministic.

**UI/security:** Queue/card primitives with loading, empty, recoverable failure, stale and denied states. Server enforces organization/branch/client/site/visibility scope and avoids existence leakage.

**Dependencies:** Existing request/reporting/scheduling contracts; NX4.3 enriches coverage exceptions.

**Acceptance / failure / verify:** Authorized users see only scoped records; client user and forged IDs are denied; no-exception and unavailable states differ; card order is stable; deep links do not bypass permission; aggregate remains bounded. Test service authorization/tenant/empty/stale cases and rendered desktop/tablet states.

**Estimate / priority / order:** M / P0 / 1.

## NX4.2 — Operations Center: current, inbound, and Needs Attention

**Purpose / primary user:** Let Operations answer who is working now, who is inbound next, and what needs action.

**Product behavior:** Site/post rows show current assignment and canonical clock status, inbound/next staffing, and prioritized exceptions. Branch/site/time-window filters are scoped and readable in site-local time.

**In scope:** Read-only desktop command surface, current/inbound composition, Needs Attention and responsive system states. **Out of scope:** Schedule rewrite or assignment mutation beyond authorized deep links.

**Business/data/read-model rules:** A missing assignment is never shown as a named Guard; unknown is labeled unknown; clocks do not infer scheduled coverage; existing canonical source timestamps/timezones apply.

**UI/security:** Exception-first desktop workspace; tablet collapses panels before information disappears. UI is not an authorization boundary.

**Dependencies:** NX4.1; NX4.3 for required coverage display.

**Acceptance / failure / verify:** Correct at schedule boundaries and overnight shifts; cross-hierarchy results absent; one primary action per exception; loading/empty/error/denial state is truthful; 1280px and tablet layouts usable. Test timezone boundaries, scope, responsive rendering, and source-link access.

**Estimate / priority / order:** M / P0 / 3 (parallel with NX4.4 after contracts stabilize).

## NX4.3 — Weekly CoverageRequirement and occurrence/gap foundation

**Purpose / primary user:** Represent contractual/operational demand independently from an employee assignment.

**Product behavior:** Authorized schedulers manage tenant-owned CoverageRequirements: client/site/post association, required Guard count, selected weekly weekday(s), site-local start/end, overnight support, effective start date, optional end date, lifecycle, and future-effective updates. Nexus derives a bounded horizon of required coverage occurrences and compares them against scheduled Shift/ShiftAssignment coverage.

**In scope:** Additive model/migration, weekly recurrence evaluator, stable occurrence identity, future-effective change/end behavior, required-versus-scheduled gap DTO, audit/versioning. **Out of scope:** Monthly/RRULE/holiday/rotating recurrence, per-occurrence mutation, recurring employee assignment templates, automatic scheduling, claims, or treating generated occurrences as independently mutable canonical truth.

**Business/data/read-model rules:** Requirement means staffing demand; Shift/Assignment means fulfillment. Local site timezone and existing DST rules apply; end-before-start is overnight; past occurrences/requirements are never silently rewritten. Changes to days, times, count, or end date take effect prospectively from an explicit effective date. Required, scheduled, actual coverage remain distinct; clock events alone never satisfy scheduled coverage.

**UI/security:** Bounded requirement management controls and Ops gap view; server capability/hierarchy checks, tenant ownership, audit, concurrency and migration compatibility.

**Dependencies:** PO-DEC-E4-02; selected bounded evaluation horizon; schema/migration review.

**Acceptance / failure / verify:** Invalid counts/ranges/dates rejected; overnight/DST behavior is explicit; fully covered, partially covered, uncovered, future-gap and currently-dark status calculate correctly; past results remain stable after future-effective changes; cross-tenant/hierarchy mutation/read denied; no duplicate occurrence identity. Test migration/legacy behavior, DST, time windows, scope, idempotency/concurrency and representative aggregate performance.

**Estimate / priority / order:** L / P0 / 2.

## NX4.4 — EOSR, passdown, and shift-close compliance

**Purpose / primary user:** Give a Guard one formal close workflow, an incoming Guard contextual passdown, and Operations trustworthy close status.

**Product behavior:** Guard completes and submits EOSR with a Handoff/Passdown section, then completes clock-out using the canonical clock flow. Relevant incoming Guard sees a prominent, non-blocking, dismissible and reopenable card in current/upcoming assignment context. Operations sees EOSR complete/missing/late, clock-out complete/missing, passdown included where required, notification available, and review state.

**In scope:** Additive EOSR record and immutable submit/audit path, compatible link/projection for new passdown data, incoming assignment read state, close evaluator/matrix/cards. **Out of scope:** Destructive Handoff conversion, second Guard Handoff submission workflow, generic report builder, unapproved SLA/waiver administration.

**Business/data/read-model rules:** Existing Sprint 3 Handoff history/revisions/audit remain readable. New Guard workflow submits EOSR only. Passdown is resolved solely through trusted current/next assignment and matching site/post context. Dismissal never edits/deletes content and is reopenable; persist/audit acknowledgement only when an approved obligation requires it. Missing is never failure absent a defined obligation.

**UI/security:** Mobile Guard close flow and passdown card; Operations matrix/deep links. Server derives tenant/assignment/site/post and enforces visibility; no unrelated handoff may be exposed.

**Dependencies:** NX4.1 and existing reporting/clock authority boundaries.

**Acceptance / failure / verify:** One Guard-facing close submit; legacy Handoffs accessible; only the matching incoming assignment gets a passdown; dismissal is non-destructive; no incoming assignment is an explicit state; late/retry/stale/reassignment/clock-order cases reconcile safely; cross-tenant/hierarchy reads denied. Test migration compatibility, assignment/tenant matrices, idempotency, time boundaries, mobile/desktop rendered flows and accessibility.

**Estimate / priority / order:** L / P0 / 3 (parallel with NX4.2 after contracts stabilize).

## NX4.5 — Review Queue, history separation, and deep-link workflow

**Purpose / primary user:** Separate action-required review work from operational chronology.

**Product behavior:** Permissioned acknowledgement/amendment candidates appear in Review Queue. Recent Activity, historical EOSR and historical Handoffs are chronology/filter views. Guard-only creation controls are not shown to review-only Operations roles.

**In scope:** Navigation/IA, filters, deep links and existing review actions/history. **Out of scope:** New correction authority, Ops-originated handoff creation, report builder.

**Business/data/read-model rules:** Existing capability-gated acknowledgement/amendment and immutable revision/audit semantics remain canonical; source records remain authoritative.

**UI/security:** Clear queue/history distinction with safe stale/retry feedback. Direct URLs require the same server scope/visibility enforcement as collection reads.

**Dependencies:** NX4.1; existing reporting review contracts.

**Acceptance / failure / verify:** Review candidates cannot be confused with history; users see only allowed record/action combinations; stale/retry behavior remains safe; empty queue is explicit; forbidden deep link does not leak existence. Test role matrix, tenant/scope, stale/retry, keyboard/accessibility and responsive states.

**Estimate / priority / order:** M / P1 / 4.

## NX4.6 — Site/Post operational scorecards

**Purpose / primary user:** Summarize operational coverage/risk by customer location without claiming billing or payroll behavior.

**Product behavior:** Display time-ranged required, scheduled, actual, uncovered, close-compliance and incident indicators; every metric labels its source and unavailable/estimated state.

**In scope:** Bounded site/post aggregate projections and detail reconciliation. **Out of scope:** Contract dollars, invoice/billing workflows, forecasting and advanced analytics.

**Business/data/read-model rules:** Required coverage derives from NX4.3; scheduled coverage from canonical shifts/assignments; actual from authoritative TimeRecords; close compliance from NX4.4. Unknown is never displayed as zero.

**UI/security:** Operations scorecards with drill-down source links; safe aggregate DTOs preserve hierarchy/tenant filters.

**Dependencies:** NX4.3 and NX4.4.

**Acceptance / failure / verify:** Formula labels reconcile to source detail; required/scheduled/actual remain distinct; no unavailable input becomes zero; scope holds; aggregate query cost is bounded at representative volume. Test formulas, time ranges, authorization, unknown state and measured query behavior.

**Estimate / priority / order:** M / P1 / 5.

## Execution sequence and deferred work

Execution order: **NX4.1 -> NX4.3 -> (NX4.2 and NX4.4) -> NX4.5 -> NX4.6**.

Deferred: advanced recurrence; recurring assignment templates; weekly availability redesign; compliance policy/notifications; custom reports/taxonomy configuration; payroll/export profiles; billing; AI/LLM/provider configuration; open-shift claiming; advanced analytics.

**Engineering readiness:** READY FOR ENGINEERING. No unresolved Product Owner decision blocks NX-E4.
