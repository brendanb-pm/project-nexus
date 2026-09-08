# NX4.4 Rendered Acceptance Root-Cause Analysis

## Executive result

**NX4.4 acceptance: FAIL.** Current `main` contains a discoverable Guard EOSR entrypoint and a deterministic incoming-Guard demo fixture, but the real PostgreSQL query used by `/eosr` crashes at runtime. Consequently a Guard cannot open the close form, cannot submit its passdown, and the incoming Guard cannot receive it. Operations shows only exceptions and does not expose a completed EOSR review/history surface.

This assessment made no product-code, schema, seed, migration, or configuration changes.

## Baseline and environment

- Authoritative `origin/main` / checked-out SHA: `ccaae93575275caad848121d44a640f6b338329f`.
- Standards checkout SHA: `6662773be213c56a0e6a2179c3be060bc04170bb`; loaded modules: UI/UX, Security/Auth, Data/Migrations.
- Local Next development server: `http://localhost:3000`; local PostgreSQL demo environment.
- Fixture preparation: `npm run db:migrate`, `npm run db:demo:reset`, and `npm run db:seed:validate` all passed.
- Rendered testing used the available local in-app browser. A normal Chrome surface was not exposed to the automation environment. The existing Playwright project uses Desktop Chrome, but contains only the foundation-home test.

## Rendered reproduction

| Flow / evidence                                                                        | Result                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guard A local sign-in; current shift, directions link, upcoming schedule, and Timecard | PASS. The reset data rendered the expected Cedar Plaza North / North Lobby assignment and existing clock-out. Clock buttons were not pressed because location permission is intentionally requested at that point.    |
| Guard A Reporting page                                                                 | PARTIAL. It visibly contains **End-of-shift report** and **Open end-of-shift report** to `/eosr`. Thus the originally observed missing entrypoint is not reproduced on current `main`.                                |
| Guard A opens `/eosr` from that visible link                                           | FAIL. Next’s rendered error overlay reports `relation "newer_outgoing_shifts" does not exist` from `PostgresEndOfShiftReportRepository.listIncomingPassdowns` at `src/features/eosr/postgres-repository.ts:154`.      |
| EOSR form and passdown inputs                                                          | FAIL. They are unreachable because the route fails before the form renders.                                                                                                                                           |
| Incoming Guard B schedule                                                              | PARTIAL. Its same-post, immediately following assignment renders, but the schedule has no contextual incoming-passdown card. Direct `/eosr` fails with the same server error.                                         |
| Operations Manager B Reporting                                                         | PARTIAL. Legacy Handoff, activity, and incident review render; no EOSR record/review item renders.                                                                                                                    |
| Operations Center                                                                      | PARTIAL. The seeded completed close correctly produces no incomplete-close exception, but the page shows only the unrelated incident card; it has no EOSR-complete/passdown/review matrix or completed-close history. |

### Reconciliation of the user-observed missing entrypoint

The user observation is credible for the preceding feature commit `0801790`: its Reporting workspace still rendered **End-of-shift handoff** rather than a link to `/eosr`. The later `e556045` change (now on `main`) replaced that legacy submit area with the visible EOSR link and added the incoming-Guard seed. Therefore the observation is explained by a stale pre-completion working checkout/runtime, not by current-main role gating. It does not make current `main` acceptable: the newly discoverable route is broken at its real database boundary.

## Trace findings

### EOSR

The intended path is implemented as `EndOfShiftReportForm` -> `submitEndOfShiftReport` server action -> `EndOfShiftReportService` -> `PostgresEndOfShiftReportRepository` -> additive `end_of_shift_reports` tables in `drizzle/0015_nostalgic_puck.sql`.

The Guard discovery path is Reporting -> visible `href="/eosr"` link -> `src/app/eosr/page.tsx`. The route resolves both the Guard’s own assignments and incoming passdowns before rendering. It is neither clock-state gated nor hidden by the Guard role in the rendered current-main result. The route is rendered only after both reads succeed, so the unrelated-to-form incoming-passdown read prevents even an outgoing Guard’s EOSR form from loading.

### Passdown

The form component does contain an always-rendered **Passdown for the incoming Guard** fieldset when it receives an authorized own assignment. It collects unresolved issues, equipment/access status, follow-up items, and unusual conditions; the service stores them immutably with the EOSR and audits submission.

The issue is wiring/runtime, not absence of the component field: `page.tsx` eagerly calls `listIncomingPassdowns()` for every EOSR page visit. Its SQL references `newer_outgoing_shifts` in a correlated raw subquery as if it were a relation, rather than rendering a valid alias/subquery. PostgreSQL rejects the generated query. The passdown cannot be submitted or read through the live page.

### Incoming Guard

The current reset seed creates the required chain:

`Guard A outgoing assignment (now -9h to now -1h)` -> `same Cedar Plaza North / North Lobby post` -> `Incoming Guard B assignment (outgoing end through now +7h)`.

It also seeds an EOSR with non-empty passdown content and a Guard B local-development persona. The live Incoming Guard B schedule visibly showed the following assignment, confirming the temporal/site/post/persona fixture is present and current-date relative. There are two delivery defects:

1. the incoming-passdown read query crashes before it can return the seeded record; and
2. the only intended card host is `/eosr`, not the current/upcoming schedule context required by NX4.4. Thus there is no incoming-Guard indication in the schedule even if the query is repaired.

## Operations assessment

`PostgresOperationsRepository` calculates `SHIFT_CLOSE_INCOMPLETE` only when a past assignment lacks EOSR or clock-out. With the deterministic completed seed, an incomplete card should not appear, and it did not. That narrowly confirms the exception-negative condition.

It does not meet the broader acceptance contract for Operations to see EOSR complete/missing/late, clock-out complete/missing, passdown status, notification availability, and review state. The Operations Center is an exception list only; completed EOSR records are absent. The Reporting review workspace enumerates activity, incident, and Handoff records only, also omitting EOSR. No rendered seeded incomplete-close scenario or EOSR review/deep-link acceptance exists.

## Defects and remediation

### NX4.4-RCA-01 — P1: EOSR route fails against real PostgreSQL

- **Observed:** Reporting’s visible EOSR link opens a server error, so the primary close flow is unusable.
- **Expected:** Authorized Guard opens EOSR and sees assignment, summary, and passdown fields.
- **Root cause:** `listIncomingPassdowns()` in `src/features/eosr/postgres-repository.ts` emits invalid SQL for `newer_outgoing_shifts`; the alias is referenced in raw SQL but is not a valid relation in that subquery.
- **Fixture contribution:** None. The fresh deterministic fixture made the fault reproducible.
- **Smallest fix:** Replace the invalid raw alias reference with a correctly correlated/aliased Drizzle subquery (or otherwise remove the broken de-duplication predicate while preserving the newest immediately prior same-post selection). Keep tenant, employee, and site/post scope enforcement intact.
- **Tests required:** PostgreSQL-backed repository/integration test for an incoming assignment and a prior EOSR; route/browser test that follows Reporting -> `/eosr` and asserts no server error plus the form fields.
- **Rendered acceptance:** Guard A opens EOSR from Reporting on the fresh reset fixture and sees/submits the passdown fields.
- **Regression risk:** tenant/site/post isolation, temporal ordering, deduplication of passdowns, and dismissal authorization.

### NX4.4-RCA-02 — P1: Incoming passdown cannot be delivered

- **Observed:** Incoming Guard B has a rendered next assignment but no passdown presentation; `/eosr` crashes.
- **Expected:** Only the matching incoming Guard receives a prominent, dismissible/reopenable, non-blocking passdown card.
- **Root cause:** Same invalid `listIncomingPassdowns()` production query as RCA-01 blocks the read model.
- **Fixture contribution:** The fixture is adequate: it contains adjacent same-post shifts, Guard B, a seeded outgoing EOSR, and passdown data.
- **Smallest fix:** Repair RCA-01, then verify the existing dismissal persistence/audit path against PostgreSQL rather than only an in-memory repository.
- **Tests required:** real database assignment matrix covering matching/nonmatching post, cancelled assignment, no incoming assignment, dismissal/reopen, and an authenticated Incoming Guard B browser journey.
- **Rendered acceptance:** Sign in as Incoming Guard B, see the seeded card, dismiss it, refresh/navigate, and reopen it without losing content.
- **Regression risk:** unauthorized cross-assignment, cross-site, and cross-tenant disclosure.

### NX4.4-RCA-03 — P2: Passdown is not contextual in the schedule workflow

- **Observed:** Incoming Guard B’s current/upcoming schedule names the assignment but gives no incoming-passdown indication or link/card.
- **Expected:** The card appears in current/upcoming assignment context, as required by the story package.
- **Root cause:** `EndOfShiftReportForm` is the sole card host and is isolated at `/eosr`; `MySchedule` neither loads incoming passdowns nor renders a card/link.
- **Fixture contribution:** None; the rendered fresh fixture proves the matching upcoming assignment exists.
- **Smallest fix:** Add a scoped read-model/card host to the Guard schedule context, or provide a prominent contextual link there, while retaining the EOSR route’s dismiss/reopen behavior.
- **Tests required:** schedule-page component/browser test for the matching incoming assignment and explicit no-card tests for unrelated post/site/tenant.
- **Rendered acceptance:** Incoming Guard’s schedule visibly identifies the passdown in the assignment context; dismissal/reopen remains non-destructive.
- **Regression risk:** disclosure scope and mobile-card usability.

### NX4.4-RCA-04 — P1: Operations lacks completed EOSR/review visibility

- **Observed:** Operations shows an unrelated incident only; completed seeded EOSR and its passdown/review state are absent from Operations and Reporting review.
- **Expected:** Operations can see close status and EOSR/passdown review information, with truthful completed/missing states and source/deep-link access.
- **Root cause:** Operations creates only incomplete-close exceptions; `ReportingWorkspace` review aggregation has no `EndOfShiftReport` entries. No completed-close matrix/history UI was implemented.
- **Fixture contribution:** The completed fixture demonstrates the omitted success/review surface; it does not exercise missing/late cards.
- **Smallest fix:** Add bounded, authorized EOSR close-status/review projection and an Operations source/deep link. Do not invent a generic report builder or alter legacy Handoff history.
- **Tests required:** completed/missing clock-out/missing EOSR/passdown-required matrices, Operations role denial/scope tests, and rendered Operations review/deep-link test using fresh fixture variants.
- **Rendered acceptance:** Operations can distinguish complete versus incomplete close and reach the authorized EOSR source where applicable.
- **Regression risk:** role scope, unknown-versus-zero status, and operational noise from exception ranking.

## Why prior acceptance passed

The automated acceptance was materially insufficient:

1. `tests/eosr-ui.test.tsx` renders `EndOfShiftReportForm` with supplied objects and mocked callbacks. It proves component markup/dismiss button labels, not `/eosr` server rendering or database SQL.
2. `tests/eosr.test.ts` uses an in-memory `Repo`, so the invalid Drizzle/PostgreSQL SQL cannot execute.
3. `tests/reporting-ui.test.tsx` asserts only that an anchor has `href="/eosr"`; it does not follow it or assert form usability.
4. The existing Playwright suite has one `home.spec.ts` test for the foundation heading. It has no local-auth, demo-DB, EOSR, passdown, incoming-Guard, Operations, or navigation coverage.
5. The updated demo fixture and Reporting link landed after the earlier `0801790` state, explaining the stale local user observation; no rendered, version-pinned acceptance reset and walked the current main fixture.
6. Operations tests/component assertions did not cover a complete EOSR review surface or an end-to-end incomplete-close fixture.

## Required engineering execution order

1. Repair and PostgreSQL-integration-test the incoming-passdown repository query (RCA-01).
2. Add an authenticated browser journey from Reporting to a working EOSR form and submit it on a controlled fresh fixture.
3. Add Incoming Guard B rendered delivery, dismissal, reopen, and negative-scope journeys (RCA-02).
4. Place the incoming passdown in current/upcoming schedule context (RCA-03).
5. Implement and verify bounded Operations EOSR close/review visibility with complete and incomplete seeded scenarios (RCA-04).
6. Make the deterministic demo reset plus these desktop and mobile browser journeys a required NX4.4 acceptance gate.

## Verification evidence

- PASS: `npm run db:migrate`; `npm run db:demo:reset`; `npm run db:seed:validate`.
- PASS: targeted unit/component suite — 4 files, 10 tests (`eosr`, EOSR UI, Reporting UI, Operations UI).
- PASS: `npm run typecheck`, `npm run lint`, `npm run build`.
- PASS but inadequate: `npm run test:e2e` — one Desktop Chromium foundation-home test.
- FAIL: rendered fresh-fixture EOSR route in authenticated Guard A and Incoming Guard B sessions; PostgreSQL relation error reproduced.

## Regression areas

Guard current/near-close/post-clock-out state, retry/idempotency, all passdown assignment-time ordering, cancelled/reassigned shifts, tenant/hierarchy filtering, non-destructive dismissal, stale/failed submissions, Operations completed versus incomplete close projection, reporting legacy Handoff preservation, mobile layout, and desktop browser navigation.
