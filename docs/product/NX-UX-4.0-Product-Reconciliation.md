# NX-UX-4.0 Product Reconciliation and Sprint 4 Backlog

**Status:** Approved Sprint 4 product package.
**Baseline reviewed:** `main` at `6abdc5714641d99434cea5b75fa89d52c2f2a113` (Sprint 3 closed/PASS).
**Scope:** Product reconciliation only; this document neither approves implementation nor changes a production contract.

## 1. Executive summary

NX-UX-4.0 correctly identifies that Nexus has strong operational primitives but lacks an Operations-facing exception model. The recommended Sprint 4 is a bounded **Operations Center foundation**: make existing shifts, assignments, clock events, handoffs, incidents, and time records actionable through a tenant-scoped, bounded read model; add the smallest new scheduling-domain capability required to identify planned coverage independently of an employee assignment.

Sprint 4 must not become a compliance rewrite, payroll, configurable reporting, or AI scheduling. The approved recurrence boundary is weekly recurring CoverageRequirements only; complex recurrence remains deferred. EOSR is the canonical end-of-shift record and contains the handoff/passdown section. The core recommendation is **NX-E4 Operations Center and Coverage Foundation**, with six vertical stories and no remaining Product Owner gates.

## 2. Current product baseline

| Area         | Durable capability                                                                                                                    | Current presentation / limitation                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Scheduling   | One-off, timezone-aware Shift; positive staffing requirement; authorized ShiftAssignment; draft/publish lifecycle                     | No coverage-template/recurrence model, open-shift state, or Ops exception view                                                |
| Availability | Employee-owned `AVAILABLE`/`UNAVAILABLE` half-open intervals; unavailable blocks; absence is `UNKNOWN` warning                        | Point-in-time interval entry only; no weekday pattern, exceptions, preference, or recurrence                                  |
| Eligibility  | Active same-tenant employee, no overlap, post requirements, armed authorization, valid credential/certification checked on shift date | Current evaluator is deterministic but uses type-name requirements; no policy definitions or candidate/explanation read model |
| Timekeeping  | Server-authoritative append-only ClockEvents; corrections; derived TimeRecords; explicit approval                                     | Guard Timecard exists; no Ops exception/period-review aggregate or export boundary                                            |
| Reporting    | Assignment-bound Activity/DAR, incident gate, IncidentReport, Handoff; acknowledgement and immutable amendment history                | Reporting workspace combines Guard submission and Ops review/history; no End-of-Shift Report record or close-obligation model |
| Compliance   | Multiple normalized credentials/certifications per employee, status, verification, renewal history, expiry                            | No credential definitions, jurisdiction/requirement policy, notification policy, or assignment-risk read model                |
| Guard UX     | Current/upcoming schedule, human-readable local time, directions, authoritative clock CTA, Timecard, reporting/handoff                | A cohesive Report hub and close checklist are still UI work                                                                   |

All new read paths must preserve the authenticated request boundary, capability/scope authorization, tenant predicates, bounded/stable collection reads, and append-only audit behavior for material actions.

## 3. NX-UX-4.0 assessment

| UX recommendation                             | Classification            | Existing support                                         | Missing capability / dependency                                                    | Sprint recommendation                                                  | Risk   |
| --------------------------------------------- | ------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| Guard authoritative clock card and recovery   | B: existing capability/UI | Server clock context and one primary action exist        | Consolidated card/recovery states                                                  | UI follow-up, not E4 gate                                              | Low    |
| Guard Report hub and close checklist          | C/D                       | Activity, Incident, Handoff exist                        | Canonical EOSR plus passdown delivery/read state                                   | EOSR/passdown slice in NX4.4                                           | Medium |
| Weekly availability editor                    | C/D                       | Point intervals, UNKNOWN/unavailable semantics           | Recurring patterns, exceptions, DST persistence; preference semantics              | Deferred after E4                                                      | High   |
| Coverage requirement distinct from assignment | C/D                       | Shift stores staffing requirement only                   | CoverageRequirement/template, occurrence materialization and gap evaluator         | E4 foundation                                                          | High   |
| Recurring schedule editing                    | C/D                       | Timezone/DST validation exists                           | Series, occurrence, effective range, edit semantics                                | Deferred supporting epic                                               | High   |
| Ops Needs Attention / active coverage         | D                         | Source records exist                                     | Bounded aggregate/read model and explicit exception taxonomy                       | E4                                                                     | Medium |
| Shift-close matrix                            | C/D                       | Clock, Handoff, activity/incident exist                  | EOSR obligation/evaluator and passdown availability                                | NX4.4 thin canonical close model                                       | Medium |
| Review Queue versus Recent Activity           | B/D                       | Acknowledgement/amendment history exists                 | Role-specific read composition and filters                                         | E4                                                                     | Low    |
| Credential policy and assignment risk         | C                         | Credential/certification instances and eligibility exist | Definitions, jurisdiction/applicability, warning policy, recipients                | Deferred compliance epic; prerequisite for advanced recommendations/AI | High   |
| Tenant report types                           | C/E                       | Canonical reports exist                                  | Bounded ReportDefinition and submission model                                      | Deferred                                                               | High   |
| Incident taxonomy labels                      | C/E                       | Canonical incident core exists                           | Versioned taxonomy configuration                                                   | Deferred; never replace canonical core                                 | Medium |
| Payroll/timecard export                       | C/E                       | Authoritative TimeRecord and approval exist              | Period state, exceptions/locking policy, external IDs, export contract             | Foundation discovery; delivery later                                   | High   |
| AI coverage recommendation                    | C/E                       | Deterministic assignment validation exists               | Candidate explanation/validation contract, provenance/staleness, provider boundary | AI-ready seam only; no AI feature in Sprint 4                          | High   |

Classification keys: A approved product requirement; B existing capability/UI-only; C new backend/domain capability; D Sprint 4 candidate; E deferred; F Product Owner decision required.

## 4. Approved requirements and conflicts/gaps

Approved product direction is: Operations Center answers who is working/inbound, close compliance, actionable exceptions, future staffing and coverage risk; coverage demand is distinct from employee assignment; hard qualification and unavailable conflicts cannot be bypassed; and all future AI consumes—not replaces—deterministic Nexus eligibility.

The material conflicts/gaps are:

1. `Shift.staffingRequirement` describes staffing demand on an individual shift, not a recurring CoverageRequirement. It cannot safely represent a continuing contractual demand or distinguish an unfilled occurrence from no planned coverage.
2. Existing availability is interval-based. UX options such as weekly repetition, "prefer to work," copied weekdays and exceptions alter its persistence/semantics. A UI adapter alone is insufficient.
3. Nexus has Handoff but no implemented DailyActivityReport/End-of-Shift Report workflow despite the domain diagram naming one. PO-DEC-E4-01 resolves this: EOSR is the canonical future shift-close record; Handoff is its passdown section, delivered to the incoming Guard.
4. Credential/certification instances preserve history and future-date eligibility, but they do not provide tenant-defined credential policy, multi-jurisdiction requirement mapping, notification policy, or explainable risk.
5. TimeRecords are authoritative operational evidence and approval exists, but there is no approved period-locking or export schema. Payroll calculations remain outside Nexus.

## 5. Operations Center target model

The Operations Center is an authorized, read-oriented command surface, not a new system of record. Its first viewport is composed from existing and, where approved, newly normalized coverage data:

`Required coverage -> scheduled occurrences -> assignments -> actual clock/time evidence -> actionable exceptions`.

The minimum read contract returns site/post, local operating timezone, relevant shift/occurrence, assigned/inbound employee display identity, canonical clock state, close-obligation status, risk age/severity, and deep-link target. It must never expose unpermitted employee/compliance information, unbounded narratives, raw audit data, or another tenant's existence.

Exception categories in Sprint 4: current uncovered coverage; imminent unassigned occurrence; missed/exception clock event; incomplete/late close obligation; incident awaiting authorized review; and credential risk where existing deterministic evidence can support it. Each is a derived status with source-record links, not a mutable duplicate workflow.

## 6. Scheduling and availability reconciliation

Sprint 4 should introduce the **coverage requirement boundary** with the approved minimum policy: site/post, local time window, required guard count, selected weekly weekdays, effective start date, optional end date, and publication state. It should support a thin occurrence/gap evaluator only for the approved horizon; complex recurrence, per-occurrence edits, employee claim, and automatic assignment/generation remain deferred.

Current availability semantics remain authoritative: explicit `UNAVAILABLE` blocks; explicit `AVAILABLE` is positive evidence; no record is `UNKNOWN`; hard qualification/security conflicts cannot be overridden. "Prefer to work" is a new soft preference and requires Product Owner approval before persistence. Weekly/overnight patterns and date overrides require a separate recurrence model with IANA local-time and DST rules; no historical ClockEvent or TimeRecord may be copied.

## 7. Shift-close and reporting reconciliation

Activity/DAR and IncidentReport remain separate canonical records. Under **PO-DEC-E4-01**, the future EOSR is the canonical formal close record. Its Handoff/Passdown section captures incoming-guard-relevant unresolved issues, active incidents, follow-up items, equipment/access issues, unusual conditions, and relevant site notes. Guard flow is: `complete EOSR (including passdown) -> submit EOSR -> complete clock-out -> incoming Guard sees contextual passdown card -> dismisses/acknowledges -> can reopen`.

The safest transition is **new EOSR with linked, compatibility-preserved Handoff data**. Existing Sprint 3 Handoff rows, immutable revisions, audit events, acknowledgement history, and Operations review remain historical canonical records. During migration, an EOSR submission creates its canonical EOSR and either an internally linked passdown projection or a compatible linked Handoff record; the Guard sees only one EOSR submission workflow. Do not destructively rewrite historical Handoffs. A future additive migration may introduce `end_of_shift_reports` and a nullable link from new Handoff-compatible passdown data to EOSR; legacy Handoffs remain readable and reviewable.

Incoming-Guard dismissal is a user-specific, non-destructive read state scoped to the applicable incoming assignment/site/post. The card remains reopenable. Record an append-only acknowledgement/audit event only when the tenant's approved obligation requires acknowledgement; a simple local read/dismiss state need not become a blocking workflow. This is an implementation policy choice, not a Product Owner blocker.

Custom narrative report types and versioned incident-taxonomy labels are bounded future configuration work. They do not replace canonical IncidentReport context, severity, narrative, actions, audit, search, or discovery data.

## 8. Licensing, payroll, AI, and metrics reconciliation

### Licensing/compliance

Current instances support multiple records, verification, renewal history, state, expiry, and shift-date evaluation. They are adequate for current static qualification checks, but not for policy-defined jurisdiction, definition-level expiry thresholds/recipients, proof retention, or assignment-risk dashboards. Robust policy-based eligibility must precede AI scheduling and any recommendation beyond the current deterministic assignment guard.

### Payroll/timecard export

The product requirement is an authorized export of **authoritative time data**, not merely CSV. Sprint 4 should specify the read contract and data gaps (external employee/site/client IDs, date range, clock pairs, derived duration, corrections, exceptions, approval status, grouping). Delivery belongs after an explicit time-period approval/lock decision; provider mappings, overtime, pay rates, tax and wage rules are deferred.

### AI scheduling

Sprint 4 must retain/strengthen an AI-ready seam only: a pure deterministic eligibility/candidate explanation contract and revalidation-before-apply boundary. Do not add provider credentials, prompts, LLM calls, schedule generation, or automated publish. Future proposals require source-state freshness/versioning, least-PII candidate data, audit provenance, human review, and provider-neutral secret handling.

### Site/customer metrics

Metrics are derived read models. Required coverage hours needs CoverageRequirement; scheduled hours derive from approved occurrences; actual worked hours from authoritative TimeRecord; uncovered hours/gaps from the coverage evaluator; close compliance from approved obligation policy. Contracted dollars, invoicing, and billing integration are not needed to expose operational coverage risk.

## 9. Proposed Sprint 4 boundary

**In scope:** Operations Center shell and bounded exception aggregate; current/inbound staffing using existing records; review queue/history separation; weekly recurring CoverageRequirement and occurrence/gap foundation; canonical EOSR/Passdown slice with incoming-Guard contextual presentation; shift-close status; deep links to existing operational workflows; consistent loading/empty/denial/stale states.

**Out of scope:** full recurring schedule management, weekly availability recurrence, preferred availability, claimable marketplace, credential-policy expansion, custom reports, incident taxonomy configuration, payroll exports, provider integration, AI recommendations/generation, billing, and advanced analytics.

This is the minimum coherent increment that makes Ops intervention-oriented without pretending existing records supply policies they do not yet contain.

## 10. Proposed epic and story map

### NX-E4 — Operations Center and Coverage Foundation

| Key   | Title                                                    | Priority | Estimate | Sprint |
| ----- | -------------------------------------------------------- | -------- | -------- | ------ |
| NX4.1 | Operations exception contract and capability boundary    | P0       | M        | 4      |
| NX4.2 | Operations Center current/inbound and Needs Attention    | P0       | M        | 4      |
| NX4.3 | Coverage requirement and occurrence/gap foundation       | P0       | L        | 4      |
| NX4.4 | EOSR, passdown, and shift-close compliance               | P0       | L        | 4      |
| NX4.5 | Review Queue, history separation, and deep-link workflow | P1       | M        | 4      |
| NX4.6 | Site/Post operational scorecards                         | P1       | M        | 4      |

### NX4.1 — Operations exception contract and capability boundary

**Purpose / user:** Give authorized Operations users one bounded, tenant-scoped source of actionable exceptions.

**Product behavior:** Derive exception cards from canonical shifts, assignments, ClockEvents/TimeRecords, Handoffs, IncidentReports, and approved coverage data. Each card includes severity, age, site/post, affected shift/person only where authorized, source link and allowed action.

**In scope:** Explicit exception taxonomy, service/repository contract, stable filters/cursors, source links, Operations capability enforcement. **Out:** new operational records, ownership workflow, AI ranking.

**Business rules:** Source records remain authoritative; no existence leakage; severity is deterministic and documented; each collection is bounded; material resolution actions occur in their original feature service.

**Dependencies:** Product decision on close obligations; NX4.3 for coverage-derived exceptions.

**Acceptance criteria:** Authorized scoped Ops sees only permitted exceptions; a client user/forged ID is denied; empty state distinguishes no exceptions from unavailable data; cards deep-link to permitted source workflow; ordering is deterministic; query count does not grow per card.

**Backend/UI/security/test:** New read contracts and aggregate queries; responsive queue/cards; request-boundary scope/capability checks and safe DTOs; unit/service authorization, tenant isolation, aggregate/empty/stale, and rendered desktop/tablet checks.

### NX4.2 — Operations Center current/inbound and Needs Attention

**Purpose / user:** Let Operations answer who is working now, who is inbound, and what needs action.

**Product behavior:** Site/post rows show current assignment/clock status, next/inbound coverage, and an actionable exception summary. Filters are branch/site/time-window scoped.

**In scope:** Read-only Command Center viewport, existing-shift staffing, Needs Attention cards, loading/empty/error/permission states. **Out:** schedule creation rewrite, employee assignment mutation beyond deep links.

**Business rules:** Site local time is operator-readable; unknown is labeled unknown; a missing assignment is never represented as a named employee; canonical clock state wins.

**Dependencies:** NX4.1; NX4.3 enriches planned coverage.

**Acceptance criteria:** Correct current/inbound result around shift boundaries; cross-hierarchy data absent; no generic activity feed presented as attention; one primary allowed action per exception; 1280px layout and tablet collapse remain usable.

**Backend/UI/security/test:** Compose NX4.1 DTO; desktop command surface; no UI-only authorization; boundary, time-zone, empty/denial, and rendered responsiveness tests.

### NX4.3 — Coverage requirement and occurrence/gap foundation

**Purpose / user:** Represent required site/post coverage separately from an employee assignment.

**Product behavior:** Authorized scheduling users create/manage the approved minimum CoverageRequirement and receive a bounded occurrence/gap evaluation horizon.

**In scope:** Additive tenant-owned requirement model, local-time definition, required count, effective range, lifecycle, occurrence evaluator, gap read DTO, audit/versioning. **Out:** full recurrence editor, edits-to-series semantics, claimable shifts, automatic assignment/generation.

**Business rules:** Requirement is not an assignment; occurrences use site IANA timezone; DST ambiguity/nonexistence follows existing scheduling integrity rules; completed history is immutable; availability/eligibility are not bypassed.

**Dependencies:** Approved weekly recurrence boundary; selected evaluation horizon; data migration review.

**Acceptance criteria:** Tenant/hierarchy and capability enforcement; invalid time/range/count rejected; DST/overnight behavior explicit; required/scheduled/uncovered counts are correct; no duplicate occurrence identity within a requirement/horizon; source changes refresh derived gap state.

**Backend/UI/security/test:** New schema/repository/service and migration; bounded admin/scheduling control plus Ops view; scoped mutation/audit/concurrency; migration, DST, tenancy, idempotency, gap and performance-bound tests.

### NX4.4 — EOSR, passdown, and shift-close compliance

**Purpose / user:** Give Guards one formal shift-close flow, give incoming Guards a prominent applicable passdown, and give Operations truthful close status.

**Product behavior:** Guard completes one EOSR containing required shift summary and Handoff/Passdown section, submits it, and completes clock-out through the canonical clock workflow. The relevant incoming Guard sees a non-blocking, dismissible/reopenable contextual card on current/upcoming assignment. Operations sees EOSR complete/missing/late, clock-out complete/missing, passdown included where required, incoming notification available, and outstanding review.

**In scope:** Additive canonical EOSR model and immutable submission/audit; compatibility link/projection for new passdown data; incoming-assignment read/dismiss state; close evaluator and matrix/cards. **Out:** destructive Handoff migration, a second Guard Handoff form, arbitrary tenant report builder, unapproved SLA/waiver/escalation administration.

**Business rules:** Existing Handoff history remains immutable/readable. New Guard submissions use EOSR only. Passdown applies only through authorized next/current Site/Post assignment context. Dismissal never changes EOSR/passdown content and is reopenable; acknowledgement/audit is required only where an approved obligation calls for it. No absence is failed unless an obligation is defined. Clock exceptions remain evidence; timezone and scheduled end are explicit.

**Data / service impact:** Additive EOSR lifecycle/assignment context, passdown compatibility relation, incoming-read state only if persisted; bounded evaluator that uses EOSR, clock evidence, and existing review data. **UI impact:** Guard close flow, contextual card, Operations close matrix. **Security / tenant isolation:** Server derives assignment/site/post/tenant; direct links and passdown reads enforce scope and avoid existence leakage.

**Dependencies:** NX4.1 and existing clock/reporting authority boundaries.

**Acceptance criteria:** Exactly one Guard-facing close submission; legacy Handoffs remain accessible; matching incoming assignment gets only its relevant passdown; dismissal does not delete or hide it permanently; EOSR/clock/passdown statuses distinguish complete, missing, late and unknown truthfully; unauthorized/cross-tenant reads are denied; deep links remain authorized.

**Failure / edge cases:** no incoming assignment; late EOSR; stale/retry submit; passdown without content; incoming assignment reassigned; clock-out before/after EOSR; legacy-only history. **Test / verify:** migration compatibility, service authorization/tenant/assignment matrix, idempotency/stale behavior, evaluator time boundaries, UI accessibility/mobile and rendered Guard/Ops flows. **Estimate / priority / order:** L / P0 / 4.

### NX4.5 — Review Queue, history separation, and deep-link workflow

**Purpose / user:** Separate review-required records from read-only chronology.

**Product behavior:** Ops sees permissioned acknowledgement/amendment candidates in Review Queue; Recent Activity and submitted handoffs are history filters. Guard-only submission controls remain absent for review-only roles.

**In scope:** Navigation/IA, filters, deep links, existing review actions and immutable history. **Out:** new correction authority, Ops-originated handoff creation, report builder.

**Business rules:** Existing capability-gated review and audit/revision semantics remain canonical. **Dependencies:** NX4.1 optional shared queue contract.

**Acceptance criteria:** Review candidates and history cannot be confused; users see only record types/actions they may perform; acknowledgement/amendment retains retry/stale handling; direct links do not bypass scope.

**Backend/UI/security/test:** Existing reporting contracts with composed reads; Ops shell; server authorization preserved; role matrix, stale/retry, accessibility and responsive tests.

### NX4.6 — Site/Post operational scorecards

**Purpose / user:** Summarize operational coverage and risk by customer location without making a billing claim.

**Product behavior:** Display required, scheduled, actual, uncovered, close-compliance and incident indicators with clear unavailable/estimated labels.

**In scope:** Bounded site/post aggregates based on available evidence. **Out:** contract billing dollars, forecasting, advanced analytics dashboards.

**Business rules:** Actual time derives only from authoritative TimeRecords; required coverage appears only where NX4.3 data exists; metrics have an explicit time range and source status. **Dependencies:** NX4.3 and NX4.4.

**Acceptance criteria:** Formula labels reconcile to source detail; no metric is shown as zero when data is unknown; hierarchy/tenant filters hold; aggregated performance stays bounded at representative volume.

**Backend/UI/security/test:** Aggregate projections/index measurement only if justified; scorecards; safe aggregated DTOs; formula, authorization, unknown-state, performance and rendered tests.

## 11. Dependencies and execution order

1. Implement NX4.1 read/capability contract.
2. Implement NX4.3 coverage foundation with approved weekly recurrence.
3. Build NX4.2 and NX4.4 against canonical aggregate contracts.
4. Deliver NX4.5, then NX4.6.

Credential policy expansion is a dependency for any AI or advanced recommendation, but not for displaying the current evaluator's explicit failures. Payroll/export discovery can run independently and must not block E4.

## 12. Product Owner decision register

| ID           | Decision                                            | Why it matters / options                                                                                                                                                                          | Recommendation                                                                 | Consequence of deferral                                 |
| ------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| PO-DEC-E4-01 | EOSR / Handoff                                      | **APPROVED:** EOSR is the canonical end-of-shift record. Handoff/passdown is a section within EOSR and is surfaced automatically to the incoming Guard as a dismissible, contextual notification. | New EOSR with linked/compatible passdown data; preserve historical Handoffs.   | Resolved; enables NX4.4.                                |
| PO-DEC-E4-02 | CoverageRequirement recurrence                      | **APPROVED:** weekly selected weekdays, site-local time, required Guard count, overnight support, effective start date, optional end date. Complex recurrence and series edits are deferred.      | Implement only the approved weekly boundary in NX4.3.                          | Resolved; enables coverage foundation.                  |
| D3           | Is availability preference an approved soft signal? | Keep available/unavailable/unknown only; add persisted preference                                                                                                                                 | Keep current hard semantics in Sprint 4; decide preference later               | Weekly editor cannot include preference as durable data |
| D4           | Are Guards allowed to claim open work?              | No claim; interest/request; qualified self-claim                                                                                                                                                  | No claim in Sprint 4                                                           | No impact on Ops-managed gap visibility                 |
| D5           | Compliance policy minimum before recommendation     | Current type-name evaluator; add definitions/jurisdictions/site requirements                                                                                                                      | Expand compliance before AI/advanced recommendations, not before E4 visibility | AI and automated suggestions remain blocked             |
| D6           | Time-period approval/lock and export placement      | Sprint 4 foundation; Sprint 5; no export                                                                                                                                                          | Specify foundation now; deliver export after period policy, likely Sprint 5    | No safe export acceptance criteria                      |
| D7           | AI V1 level and autonomy                            | No AI; find coverage; multi-conflict; draft schedule                                                                                                                                              | No AI feature in Sprint 4; future Level 1 only after eligibility policy        | Provider/configuration work remains deferred            |
| D8           | Custom reporting configuration timing               | Sprint 4; later bounded reporting epic                                                                                                                                                            | Defer; preserve canonical workflows                                            | Guard Report hub lists only existing canonical reports  |

## 13. Deferred backlog

- **NX-E5 Scheduling recurrence and availability patterns:** weekly/overnight availability, exceptions, preference (if approved), recurring schedule series and safe occurrence edits.
- **NX-E6 Compliance policy and eligibility:** CredentialDefinition, jurisdiction/applicability, requirement mapping, proof/retention, notifications, assignment-risk reporting.
- **NX-E7 Controlled reporting configuration:** ReportDefinition/submissions and versioned incident taxonomy labels; no generic form builder.
- **NX-E8 Authoritative time export:** period review/lock and generic export contract; provider profiles later.
- **NX-E9 AI-assisted scheduling:** provider-neutral configuration, candidate proposals, provenance/freshness/revalidation and human review.
- Advanced analytics, payroll/tax/overtime, billing integration, open-shift marketplace, automatic assignment/publish, and V2 patrol/EP remain outside Sprint 4.

## 14. Risk and failure-mode analysis

| Risk                        | Failure mode                                                      | Control                                                                    |
| --------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Duplicate coverage concepts | Requirement and Shift/assignment become competing truth           | Document demand/occurrence/assignment ownership; one evaluator             |
| False close failures        | UI treats absent, undefined report as late/missing                | Policy-backed tri-state obligation evaluation                              |
| Tenant/PII leakage          | Ops aggregate joins expose employee/compliance data outside scope | Request-boundary scope, minimal DTOs, denied-path tests                    |
| Recurrence/DST corruption   | Copying instants alters site-local intent                         | Local-time rule plus explicit DST resolution; never copy clock history     |
| Unsafe AI                   | LLM substitutes for legal eligibility                             | Deterministic candidate pool and revalidation only                         |
| Payroll overreach           | Worked time becomes wage/tax calculation                          | Export authoritative evidence only; no calculation rules                   |
| Aggregate performance       | Command Center issues per-card queries                            | Set-based projections, bounded horizon/cursors, representative measurement |

## 15. Traceability matrix

| Dogfood finding                    | NX-UX-4.0 recommendation                           | Product requirement                                                 | Proposed disposition/story                |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| Ops surfaces overlap               | Command Center, Review Queue, history separated    | Actionable exceptions before generic activity                       | NX4.1, NX4.2, NX4.5                       |
| Close exceptions buried            | EOSR/passdown and shift-close priority queue       | PO-DEC-E4-01: EOSR canonical; passdown contextual to incoming Guard | NX4.4, NX4.1, NX4.2                       |
| Staffing gap invisible             | Active coverage/open shifts/coverage health        | PO-DEC-E4-02: weekly CoverageRequirement distinct from assignment   | NX4.3, NX4.2, NX4.6                       |
| Schedule availability is technical | Weekly local-time editor                           | Preserve unavailable/available/unknown and hard conflicts           | Deferred NX-E5; D3 required               |
| Single credential mental model     | Definitions separate from employee records         | Policy-driven multi-jurisdiction eligibility                        | Deferred NX-E6; blocks AI recommendations |
| Reporting is undiscoverable        | Guard Report hub/close checklist                   | Canonical report separation and bounded custom reports              | UI follow-up; D1/D8; NX-E7 deferred       |
| Timecard needs external use        | Review/resolve/approve/export                      | Authoritative time export, not payroll                              | Deferred NX-E8; D6 required               |
| Future optimization desired        | Deterministic pool -> recommendation -> revalidate | AI never decides hard eligibility                                   | AI-ready seam only; NX-E9 deferred        |

## 16. Recommended next execution sequence

1. Create a technical discovery note validating E4 aggregate sources, selected coverage horizon, EOSR/Handoff compatibility migration, and data migration contract.
2. Approve NX-E4 and execute NX4.1 through NX4.6 in dependency order.
3. Reassess E4 metrics and close-compliance usefulness with representative tenant data before scheduling E5/E6.
4. Do not schedule AI, provider credentials, custom reporting, payroll export, or claimable shifts without their separate approved product decisions.

## Approval status

**SPRINT 4 — READY FOR ENGINEERING.** PO-DEC-E4-01 and PO-DEC-E4-02 are approved. D3, D6, D7 and D8 govern deferred epics and do not block NX-E4.
