# Project Nexus - Sprint 1

## Sprint identity

**Name:** Organizations, Sites & People  
**Release channel:** MAIN  
**Implementation sequence:** NX-1.1 through NX-1.5  
**Dependency:** Sprint 0B must be accepted and merged before Sprint 1 feature implementation begins.

## Goal

Deliver secure, tenant-scoped administration of the organizational, client, site, post, user, employee, credential, and certification records required by later operations workflows. Sprint 1 must reuse Sprint 0B persistence, authorization, tenancy, visibility, audit, and revision foundations.

## Non-goals

- Scheduling, shift assignment, clock, activity, incident, handoff, billing, reporting, or asset workflows.
- Vehicle patrol, fleet, route optimization, Executive Protection, travel, protected-person, medical/HIPAA, mesh, or Mission Edge functionality.
- A new authentication provider, tenant mechanism, authorization framework, audit framework, design system, or persistence abstraction.
- Bulk import, payroll, applicant tracking, learning management, document storage, or contract accounting.
- Destructive hard deletion of operationally referenced records.

## Cross-story architecture

### Responsibilities

- **Domain contracts:** Sprint 0B remains canonical for entity names, roles, capabilities, scopes, service types, visibility, audit events, and record lifecycle concepts. Add only boundary-specific request/response types needed by these stories.
- **Persistence:** Extend the existing Drizzle/PostgreSQL schema and migrations only where a story requires a missing field, constraint, index, or relationship. Repository queries must be tenant-bounded and return bounded projections.
- **Services:** Application services own validation, authorization, tenant/scope checks, uniqueness decisions, lifecycle transitions, and transactional mutation plus audit emission. Repositories do not independently invent policy.
- **API/server boundary:** Authenticate the actor, load authoritative membership/scope, validate input, invoke the centralized authorization decision, and call one application service. Client-supplied organization, branch, client, site, employee, role, or visibility identifiers are never sufficient authority.
- **UI:** Server Components perform authorized initial reads where appropriate. Small Client Components handle forms and interaction. UI route visibility is usability only, not authorization.
- **Presentation:** Reuse the established theme and reusable components. Present human-readable context instead of asking users to recall UUIDs.

### Shared lifecycle rules

- Administrative records use explicit active/inactive or status transitions. Referenced records are deactivated rather than hard-deleted.
- Create/update/deactivate/reactivate actions are authoritative server mutations and emit audit events in the same transaction where feasible.
- All list reads are paginated, bounded, filterable, and deterministically sorted.
- Mutations use optimistic concurrency or an equivalent version check when stale edits could overwrite another administrator's change.
- Validation errors are field-specific. Permission, missing-record, and tenant-mismatch responses must not reveal whether an out-of-scope record exists.
- Successful mutations return authoritative persisted state; clients do not fabricate IDs, timestamps, audit identity, or tenant context.

## RBAC and scope requirements

Sprint 1 uses only Sprint 0B capabilities:

| Area | Read requirement | Mutation requirement | Required scope |
| --- | --- | --- | --- |
| Organization/branch | `VIEW_ORGANIZATION_ANALYTICS` or administrative read equivalent already approved | `MANAGE_ROLES` for organization-level security configuration; `ADMIN`-scoped administration for ordinary organization/branch data until a narrower capability is approved | Organization; branch where applicable |
| Clients | `VIEW_CLIENT_REPORTS` or in-scope operations visibility | `MANAGE_CLIENTS` | Organization and branch/client |
| Sites | `VIEW_SITE_OPERATIONS` | `MANAGE_SITES` | Organization, branch, client, site |
| Posts | `VIEW_SITE_OPERATIONS` | `MANAGE_POSTS` | Organization, branch, client, site |
| Employees/users | `VIEW_EMPLOYEE_COMPLIANCE` | `MANAGE_EMPLOYEES` | Organization and branch; employee where applicable |
| Credentials/certifications | `VIEW_EMPLOYEE_COMPLIANCE` | `MANAGE_EMPLOYEES` unless a later approved capability separates compliance mutation | Organization, branch, employee |

No new permission is silently introduced. The organization/branch administration mutation capability is unresolved because Sprint 0B has no general `MANAGE_ORGANIZATION` or `MANAGE_BRANCHES` capability. Implementation must obtain a product/security decision before coding NX-1.1 rather than overloading `MANAGE_ROLES` or relying on role names.

Client users have no Sprint 1 administration authority unless a future story explicitly grants a capability and narrower scope. Guards do not receive administrative list access merely because they work at a site.

## NX-1.1 - Organization and Branch administration

### Boundary

Maintain the provider organization profile and its branches, including name, status, branch timezone, and active lifecycle. Do not implement multi-organization onboarding, billing, identity-provider setup, or role administration.

### Behavior

- Display the actor's authorized organization and a paginated branch list.
- Edit allowed organization profile fields without changing tenant identity.
- Create, update, deactivate, and reactivate branches.
- Prevent deactivation when it would violate an explicitly defined invariant; otherwise preserve dependent records and exclude inactive branches from new assignments by default.
- Require valid IANA timezones and unique active branch names within an organization.
- Audit all mutations with authoritative actor and organization context.

### Acceptance

- Cross-organization reads and mutations fail closed.
- Branch list and mutation scope are derived server-side.
- Invalid timezone, duplicate name, stale update, and unsafe deactivation return stable actionable errors.
- No mutation can change an organization's stable ID.

## NX-1.2 - Client, ClientContact, and Contract administration

### Boundary

Maintain clients, their contacts, and contract header/lifecycle data. Do not implement invoicing, rate calculation, contract document storage, or client portal access.

### Behavior

- Create, view, update, deactivate, and reactivate clients within an authorized branch.
- Create, update, deactivate, and reactivate client contacts without treating email as authentication authority.
- Create and update contract name, effective dates, status, and client relationship.
- Validate contract date ordering and prohibit cross-client relationship changes.
- Preserve billing/reporting configuration references without exposing raw persistence identifiers as routine inputs.
- Audit client, contact, and contract mutations.

### Acceptance

- A user scoped to one client/branch cannot enumerate or mutate another.
- Client selection is contextual and human-readable.
- Contact validation supports absent optional phone/email while validating supplied values.
- Contract status and dates remain internally consistent.

## NX-1.3 - Site and Post administration

### Boundary

Maintain sites and static/uniformed posts for authorized clients. Geofence configuration fields may be stored, but map UI and geofence execution remain out of scope.

### Behavior

- Create, view, update, deactivate, and reactivate sites under an authorized client.
- Capture structured address, timezone, and optional coordinates/geofence configuration through validated inputs.
- Create, view, update, deactivate, and reactivate posts under an authorized site.
- Select only Sprint 0B service types; no patrol or EP type may be added.
- Capture description, armed/unarmed requirement, qualification requirements, and active state.
- Inactive sites/posts remain visible to authorized administrators through an explicit filter but are excluded from new operational selection by default.
- Audit site/post mutations and service/qualification changes.

### Acceptance

- Client/site/post parentage is loaded and checked server-side for every mutation.
- Timezone, coordinate range, service type, and required-field validation are enforced.
- A client/site-scoped user cannot escape scope by changing a submitted parent ID.
- No map, routing, patrol, or geofence-execution behavior is introduced.

## NX-1.4 - Employee and User profiles

### Boundary

Maintain provider employee profiles and their optional application-user linkage. Do not implement authentication-provider enrollment, payroll, applicant tracking, scheduling, or arbitrary role administration.

### Behavior

- Create, view, update, deactivate, and reactivate employees within an authorized organization/branch.
- Maintain employee number, employment status, primary branch, and permitted profile/contact fields.
- Create or link an application user only through a server-controlled workflow; email is a lookup attribute, not proof of identity.
- Enforce unique employee number per organization and unique user email per organization as defined by Sprint 0B.
- Prevent cross-organization user/employee links and validate primary branch ownership.
- Show roles/scopes read-only unless `MANAGE_ROLES` is separately authorized and implemented through the centralized mechanism.
- Audit employee, user-link, employment-status, and primary-branch changes.

### Acceptance

- Employee data is branch/organization scoped and least-privileged.
- Duplicate employee/email and cross-tenant relationships fail safely.
- Deactivation preserves history and prevents new operational assignment by default.
- UI does not imply that creating a user grants application access without active membership/authorization.

## NX-1.5 - Credentials and Certifications

### Boundary

Maintain credential and certification metadata for employees. Do not store medical information, upload documents, provide training/LMS workflows, or make qualification scheduling decisions.

### Behavior

- Create, view, update, deactivate/revoke, and renew credential/certification records.
- Capture type, issuing authority, issued date, optional expiration date, status, and optional non-secret document reference.
- Validate issue/expiration ordering and employee tenant/branch scope.
- Default lists surface expiring/expired state clearly without changing stored status silently.
- Renewal creates traceable history or a new record according to an implementation-time decision; it must not erase prior compliance evidence.
- Audit create/update/status/renewal actions.

### Acceptance

- Unauthorized employee compliance access is denied.
- Date and status validation is deterministic and server-enforced.
- Historical compliance evidence is preserved.
- No medical/HIPAA data or document-storage provider is introduced.

## CRUD and interaction states

Every story must implement and verify applicable states:

- **Loading:** immediate acknowledgement within 100 ms; retain stable shell and prevent duplicate submission.
- **Ready/success:** authoritative values, clear scope context, and a single primary action.
- **Empty:** explain what is absent, why it matters, and show create action only when authorized.
- **Validation error:** preserve safe user input and associate actionable errors with fields.
- **Permission denied:** fail closed with a non-leaking message and safe navigation.
- **Not found/out of scope:** use indistinguishable safe responses where disclosure would leak tenant data.
- **Transient failure:** restore controls, retain safe input, and permit idempotent retry.
- **Uncertain mutation outcome:** refresh authoritative state before retry; never blindly replay.
- **Stale/concurrent update:** show that the record changed, reload authoritative state, and preserve recoverable input where safe.
- **Deactivation confirmation:** describe downstream effect without confirmation fatigue; return to a stable state on cancel/failure.

## Human-factors requirements

- No routine workflow may require memorizing or transcribing UUIDs, tenant IDs, client IDs, site IDs, post IDs, employee IDs, or role IDs.
- Parent selection uses bounded server-side search with distinguishing context such as client, site, branch, status, and timezone.
- Preserve parent context when navigating between client/site/post or employee/compliance workflows.
- Default lists are relevant, bounded, sensibly sorted, and include status.
- Known business identifiers such as employee number may remain searchable power-user inputs.
- Destructive-looking lifecycle actions use explicit deactivate/reactivate language rather than ambiguous delete language.
- Each story's completion report must classify operator-memory findings as `FIXED`, `JUSTIFIED POWER-USER INPUT`, or `DEFERRED WITH REASON`.

## Performance budgets

For normal contextual navigation and actions:

- UI acknowledgement: at most 100 ms.
- Meaningful content target: at most 500 ms.
- Complete interactive p95 target: at most 900 ms.
- Normal contextual reads: preferred 1-3 database round trips, maximum 5.
- Database hard ceiling for a normal interactive read: 400 ms.
- No N+1 reads. Batch related records, parallelize independent reads, project required fields only, paginate lists, and lazy-load secondary detail.

Performance tests may use deterministic service/repository instrumentation until a production-like database environment exists. Do not claim live p95 verification without measured runtime evidence.

## Validation requirements

- Trim and normalize user-entered strings consistently before uniqueness checks.
- Enforce required fields, bounded lengths, enum membership, valid statuses, IANA timezones, date ordering, coordinate ranges, and email/phone format when supplied.
- Validate every relationship against authoritative organization/branch/client/site/employee ownership.
- Reject unknown fields at transport boundaries where supported.
- Never accept actor, audit identity, organization authority, timestamps, IDs, or lifecycle approval from the browser.
- Apply database constraints for durable uniqueness/referential rules and service validation for operator-safe errors.

## Test contract

Each story requires:

1. Domain/service happy path for create, update, deactivate, and reactivate or the story's documented lifecycle equivalent.
2. Validation tests for required, malformed, boundary, duplicate, and invalid relationship inputs.
3. Authorization tests for missing capability, wrong organization, wrong branch/client/site, and allowed in-scope access.
4. Actor/tenant spoofing tests proving client-supplied scope cannot grant authority.
5. Audit tests proving authoritative actor, tenant, action, target, and material before/after state.
6. Repository/schema tests for constraints, tenant-bounded queries, deterministic ordering, pagination, and migration stability.
7. UI tests for loading, empty, validation, permission, success, failure/retry, deactivation, and stale-state recovery where applicable.
8. Human-factors test/review proving routine selection does not require internal identifiers.
9. Performance query-count/bounded-result tests for list/detail reads.
10. Existing Sprint 0B and bootstrap regression tests.

Cross-story tests must verify that inactive parents cannot be selected for new child records by default, cross-tenant relationship IDs are rejected, and deactivation preserves historical relationships.

## Acceptance gates

Sprint 1 is complete only when:

1. NX-1.1 through NX-1.5 satisfy their story acceptance criteria.
2. Sprint 0B architecture is reused without a competing tenancy, RBAC, audit, revision, or persistence mechanism.
3. All reads and mutations are server-authorized by capability plus authoritative scope.
4. Organization, branch, client, site, post, user, employee, credential, certification, contact, and contract relationships remain tenant-consistent.
5. Administrative lifecycle changes are auditable and historical references are preserved.
6. Loading, empty, validation, permission, transient failure, retry, uncertain outcome, and concurrency behavior are implemented and verified where applicable.
7. Human-factors audit finds no unjustified routine internal-ID entry.
8. Interactive flows meet query-count/bounded-result design requirements; measured performance claims include evidence.
9. Schema generation has no drift; migrations and deterministic seeds/fixtures validate.
10. Formatting, lint, typecheck, unit/integration/UI tests, existing E2E tests, and production build pass.
11. No Sprint 2+, patrol, EP, medical/HIPAA, map, routing, payroll, billing, scheduling, or operational reporting scope is introduced.
12. Architecture drift, new dependencies, assumptions, unresolved decisions, and incomplete verification are explicitly reported.

## Implementation sequence and dependencies

1. **Prerequisite: Sprint 0B acceptance/merge.** Resolve its architecture review and establish the canonical schema, authorization, audit, and migration baseline.
2. **NX-1.1 Organization + Branch.** Resolve the missing organization/branch mutation capability first; implement shared administrative list/form/lifecycle patterns.
3. **NX-1.2 Client + ClientContact + Contract.** Depends on active branches and establishes client selection/context.
4. **NX-1.3 Site + Post.** Depends on clients and reuses contextual parent selection; required before operational scheduling work.
5. **NX-1.4 Employee + User.** Depends on branches and authoritative user-link rules; may run after NX-1.1 in parallel with NX-1.2/1.3 only if shared UI/service primitives are stable.
6. **NX-1.5 Credentials + Certifications.** Depends on employee administration and the compliance-history decision.
7. **Sprint integration gate.** Run cross-story tenancy, lifecycle, audit, human-factors, performance, migration, regression, and production-build verification.

## Decisions required before implementation

1. **Organization/branch mutation capability:** approve a stable capability such as `MANAGE_ORGANIZATION`/`MANAGE_BRANCHES`, or explicitly define another centralized capability mapping. Role-name checks are not acceptable.
2. **Organization profile fields:** define which profile fields beyond name/status are editable in V1.
3. **Contact lifecycle:** decide whether contacts require an explicit status column or another non-destructive inactive representation.
4. **Contract lifecycle:** define the approved status vocabulary and whether overlapping active contracts are permitted.
5. **Employee profile boundary:** define allowed contact/profile fields and which are visible to each role; do not add sensitive/medical fields.
6. **User membership/linking:** define the provider-neutral active membership representation and invitation/link lifecycle before granting application access.
7. **Compliance renewal:** decide whether renewal creates a new credential/certification row linked to its predecessor or a revisioned snapshot series.
8. **Concurrency contract:** choose the common version/updated-at precondition mechanism for administrative forms.

These decisions are material product/security choices and must not be invented during implementation.

## Delivery requirements

- Implement stories on scoped feature branches using coherent commits and draft PRs into `main`.
- Do not merge automatically.
- Each PR reports acceptance status as `PASS`, `FAIL`, `NOT RUN`, or `NOT APPLICABLE`, plus validation evidence, architecture drift, assumptions, risks, and human-factors findings.
- Preserve unrelated/untracked files and do not weaken checks.

END-NEXUS-SPRINT-1-SPEC
