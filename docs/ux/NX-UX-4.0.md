# Nexus UX Consolidation — V1 Direction

**Status:** implementation-ready design package. It makes no production-code, RBAC, tenant, or backend-authority changes.

## Executive assessment and finding reconciliation

Nexus has appropriate security-operation primitives—assignments, clock events, activities, incidents, handoffs, credentials, and audit history—but presents them as isolated forms. The target experience is role-specific workspaces with **exceptions before routine information**.

| Dogfood finding                | Direction                                                    | Classification                                             |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| ISO/offset scheduling language | Weekly day/time availability editor                          | Existing UX defect; richer recurrence needs backend work   |
| Alternating clock exception    | Render only the server-authoritative next action             | Existing UX defect                                         |
| Reporting undiscoverable       | Guard Report hub and shift-close checklist                   | Missing UI over existing reporting; custom reports are new |
| Ops surfaces overlap           | Command Center, Review Queue, and history are distinct       | Existing UX defect plus aggregate read models              |
| Close exceptions buried        | Shift-close compliance becomes a priority queue              | New aggregation capability                                 |
| Single-credential mental model | Policy definitions separate from employee credential records | New product capability                                     |

Research principles: use familiar calendar recurrence (frequency, interval, weekdays, start/end); identify recurring series; distinguish employee preferences from hard eligibility; show eligible open-shift candidates and their reasoning. Reference patterns: [Connecteam recurring shifts](https://help.connecteam.com/en/articles/6852015-job-schedule-how-to-create-repeating-shifts), [When I Work eligibility/conflicts](https://help.wheniwork.com/articles/scheduling-a-shift/), and [Outlook recurring events](https://support.microsoft.com/en-us/outlook/calendar/schedule-a-meeting-or-event-in-outlook).

## Role-based IA and action hierarchy

| Role                | Navigation                                                                                            | First-class actions                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Guard, mobile-first | Home, Schedule, Report, More                                                                          | Clock state; quick activity; incident; shift-close tasks                   |
| Ops, desktop-first  | Operations Center, Schedule, Coverage, Review Queue, Incidents, Compliance, Sites & Clients           | Resolve uncovered work, review exceptions, acknowledge operational records |
| Tenant Admin        | People, Sites & Posts, Report Types, Incident Taxonomy, Credential Policies, AI Integration, Settings | Configure bounded policy/data, never generic form building                 |

Guard **Report** contains Activity/DAR, Incident, End-of-shift report, Handoff, and applicable tenant reports. Incident is a clear action but not the default Ops CTA. Admin configuration never appears in Guard navigation.

## Scheduling, availability, timezone, and clock

### Weekly availability

The mobile weekly editor has seven day rows. Each row selects **Available all day**, **Available hours**, **Prefer to work**, or **Unavailable**. Hours use Start and End time pickers; when End precedes Start, the UI automatically states **Ends next day**. The save summary says “Tue–Wed, 4:00 PM–2:00 AM next day,” never ISO/UTC offsets.

Controls: **Copy Monday to…**, Clear week, effective Starts date, and Ends: Never / On date. Exceptions are explicit date-level overrides. Device time zone is the availability default; scheduled-work context uses the site IANA zone. The governing zone is visible on review and editable only in secondary settings. DST preserves site-local wall-clock intent, previews changed occurrences, and asks Ops to resolve ambiguous/missing local times.

### Ops schedule and coverage

Views: Week, By Site, By Guard, Open Shifts. A **coverage requirement** is a demand pattern (“North Lobby, daily 00:00–08:00, requires 1 Guard”); an **assignment** fills an occurrence. Create coverage: site/post → role/count → time → repeat → effective range → occurrence review. Then assign, leave unfilled, or open to qualified claim.

Recurring editing offers **This occurrence / This and future / Entire series**. Draft creation and publish remain distinct. Conflicts are separated:

- Blocking: overlap, invalid membership, credential invalid on shift date, required qualification missing, hard unavailability.
- Warning: preference mismatch, overtime, pending verification, travel/gap risk where supported.

### Clock state

The server returns the authoritative clock state and permitted next action. Guard sees exactly one primary button: Clock In or Clock Out, plus last event. Location permission is requested only after tap and may be skipped when unavailable. Concurrent changes refresh the assignment and say “Your clock state changed elsewhere”; Nexus renders the newly valid action. Raw invariant exceptions never reach a user.

## Reporting and controlled configuration

At shift start, Guard Home offers Quick activity and Report incident. In the close window it shows a checklist: Clock out, End-of-shift report, Handoff, required tenant report. Each item has explicit completion/exception state.

| Workflow            | UX                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Activity/DAR        | assignment-derived site/post; category, narrative, optional context/action/follow-up             |
| End-of-shift report | shift summary and unresolved work; references existing records rather than duplicating them      |
| Handoff             | incoming-guard-facing unresolved items, equipment/keys, follow-up; one canonical Handoff surface |
| Incident            | structured canonical report, optional related activity, immutable original on submit             |
| Tenant report       | active applicable type, instructions, large narrative body, required/optional label              |

Incident **core fields** are assignment-derived context, identifier, severity, narrative, actions, follow-up, submission and audit history. Configurable taxonomy controls include incident type, site/post applicability, active state, instructions, and governed severity labels. Admin cannot remove canonical context/audit fields; changes version labels for historical fidelity.

Report Types configuration is deliberately bounded: name, instructions, applies to site/post, anytime/end-of-shift, required/optional, active. V1 custom reports have one narrative body—no no-code form builder.

## Operations Center

The first viewport answers: who is working, who is inbound, whether last shifts closed, unstaffed future work, coverage health, and intervention risk.

**Needs Attention** is an actionable queue, not a feed. Each card has severity, age, affected site/post/shift/person, accountable owner, and one primary action.

| Priority | Examples                                                         | Action                      |
| -------- | ---------------------------------------------------------------- | --------------------------- |
| Critical | current site uncovered; missed clock-in with no coverage         | Fill shift / escalate       |
| Urgent   | unassigned imminent shift; close report missing; handoff overdue | Assign / request completion |
| Review   | incident awaiting acknowledgement; clock exception               | Review / acknowledge        |
| Risk     | credential fails before assigned shift                           | Resolve eligibility         |

Active Coverage is site/post-oriented: **Current**, **Inbound**, **Next coverage**. Example: “Cedar Plaza / North Lobby — Guard A, 16:00–00:00, clocked in; Guard B inbound 00:00–08:00; No gap.” An unassigned next shift is high-contrast with Fill shift.

Shift Close Status summarizes `12 completed / 10 complete / 1 report missing / 1 handoff overdue`. A row evaluates clock-out, required report, handoff, and timeliness against tenant policy; each exception deep-links to the affected shift and permissible resolution.

Site/client scorecards show required coverage → scheduled → actual → exceptions: contracted hours, scheduled/worked hours, coverage %, uncovered hours, close compliance, incident volume, active incidents. Clearly label unavailable/estimated values.

**Review Queue** is permissioned work requiring acknowledgement, amendment, or escalation. **Recent Activity** is read-only chronology. “Submitted Handoffs” is a history filter; remove the duplicate Ops handoff-creation surface unless Ops-originated handoff is explicitly authorized.

## Credentials and compliance

Two admin concepts are required:

1. **Credential Definitions:** type, jurisdiction, issuing guidance, expiration policy, warning stages, recipients, assignment applicability.
2. **Employee Credentials:** type/jurisdiction, number, issuer, issue/expiry, proof, verification, renewal, status, and linked history.

An employee can have many simultaneous credential records across jurisdictions. Statuses: Current, Expiring soon, Expired, Missing, Pending verification, Inactive/Suspended. Renewal creates a new linked effective record; it does not erase history.

Admin configures warning stages and recipients—employee, operational role, arbitrary compliance address—per definition. Ops Compliance shows expired, 30/60/90-day risk, pending verification, and affected assignments where a credential is invalid **on the shift date**. Guard More > Credentials is mobile self-service: current status, expiry, required action, proof/renewal state; never the definition editor.

## AI-assisted scheduling

The trust model is explicit in every AI surface: deterministic Nexus eligibility → candidate pool → recommendation → Nexus revalidation → Ops review → apply.

| Level                | Interaction                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Find Coverage        | one open shift; ranked eligible candidates with hard eligibility, preferences, hours, conflicts, Assign/View detail |
| Suggest Resolution   | select several exceptions; review grouped proposed changes and apply selected only                                  |
| Build Draft Schedule | choose period/scope/priorities; create named Draft; compare and review before publish                               |

Hard failures are excluded, never optimized around. Recommendations show freshness and become stale after availability, credential, coverage, or assignment change; Refresh is required before apply. Admin AI Integration uses provider-neutral Provider, Model, credential status, Test connection, access/audit status. Priorities are business settings—minimize overtime, balance hours, prefer site experience, minimize changes, honor preferences, minimize travel—not prompt engineering and not hard rules.

## System and responsive states

| State             | Required behavior                                                    |
| ----------------- | -------------------------------------------------------------------- |
| Loading           | task-shaped skeleton; preserve known filters                         |
| Empty             | explain why nothing exists; show only permitted next action          |
| Validation        | inline field-specific plain language; preserve input                 |
| Permission denied | no existence leakage; route to allowed home                          |
| Stale/conflict    | identify changed record; refresh/review, never overwrite silently    |
| Failure/retry     | plain outcome, safe retry, support reference; never raw backend text |

Guard at 390×844: bottom navigation, one primary CTA above fold, 44px targets, stacked cards, full-screen report steps. Ops/Admin: dense desktop table-detail patterns at 1280px+, tablet collapses panels before hiding state. Do not shrink the Command Center into Guard mobile.

## Component/workflow handoff

| Component                  | Required inputs/states                                       | Role   |
| -------------------------- | ------------------------------------------------------------ | ------ |
| Shift state card           | assignment, authoritative next clock action, close checklist | Guard  |
| Weekly availability editor | day state/ranges, effective range, timezone                  | Guard  |
| Coverage timeline          | requirement, occurrences, assignments, severity              | Ops    |
| Exception card             | type, priority, entity links, owner, action                  | Ops    |
| Shift close matrix         | obligations, timing, completion evidence                     | Ops    |
| Report picker/form         | applicable types, assignment context, submit state           | Guard  |
| Credential policy/record   | definition or employee evidence/history                      | Scoped |
| Recommendation panel       | eligibility, preferences, freshness, changes                 | Ops    |

## Story decomposition and scope

### Sprint 4: UI defects / existing-capability presentation

1. Plain-language availability date/time controls with an adapter over current contract.
2. Authoritative clock state card, invalid-action suppression, concurrency recovery.
3. Guard Report hub, reporting navigation, and Handoff consolidation.
4. Ops shell: Operations Center, Review Queue vs history, role-appropriate CTA hierarchy.
5. Shared loading, empty, validation, permission, stale, and responsive patterns.

### Sprint 4 discovery spikes

- Confirm existing storage supports weekday, overnight, recurrence, site timezone, and exceptions.
- Confirm one read contract can supply authoritative clock state and close obligations.
- Inventory reporting, credentials, assignments, and audit data for thin aggregate views.

### Deferred: explicit new backend/product capabilities

1. Weekly availability recurrence/exceptions and DST-safe persistence.
2. Coverage requirements, recurring occurrence generation, drafts/publishing, open-shift claim, eligibility/conflict engine.
3. End-of-shift policy/completion model and Operations aggregates.
4. Custom report types/submissions; controlled incident-taxonomy versioning.
5. Credential definitions, multi-record credentials, documents, verification/renewal history, notifications, shift-date eligibility.
6. AI provider configuration, deterministic candidates, recommendation provenance/staleness, draft schedules.

### Unresolved product questions

- Which close obligations and handoff windows vary by tenant/site/post?
- Can Guards claim open shifts or only express interest?
- Which incident sections are conditional, and who manages taxonomy?
- What document retention, verification roles, and notification authorization apply to credentials?
- Which AI levels belong in V1, and can any draft publish automatically? Recommended answer: no.

Every engineering story must retain tenant scope, server authorization, audit history, and canonical clock/incident invariants. Product must resolve the applicable questions before accepting the corresponding backend work.
