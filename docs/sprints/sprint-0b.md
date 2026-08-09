# Project Nexus - Sprint 0B

## Sprint identity

**Name:** Domain Model, RBAC, Tenancy, and Architecture
**Release channel:** MAIN
**Implementation branch:** `feature/sprint-0b-domain-architecture`
**Status:** Approved for implementation

## Goal

Establish the canonical V1 domain model, persistence foundation, authorization model, tenant/data boundaries, visibility model, audit/revision model, and architecture documentation before feature UI development begins.

Sprint 0B is foundation work. It must not expand into operational feature-screen implementation.

## Product boundary

Project Nexus V1 supports uniformed/static-site physical security operations, including future capabilities for client/site/post administration, personnel, scheduling, shift assignments, clock events, DARs, incidents, handoffs, operations management, client reporting, billing-support data, compliance, asset management, and leadership reporting.

### Explicit V1 exclusions

Do not implement:

- vehicle patrol workflows
- patrol route optimization
- fleet tracking
- Executive Protection workflows
- protected-person travel management
- HIPAA/medical-data storage
- EP mission management
- mesh or Mission Edge functionality

V2 Executive Protection remains an explicitly isolated future module.

## Execution rules

Before implementation:

1. Confirm the repository is `brendanb-pm/project-nexus`.
2. Confirm the current branch.
3. Create and work only on `feature/sprint-0b-domain-architecture`.
4. Inspect the current project structure, `package.json`, installed dependencies, tests, CI, and existing documentation.
5. Preserve working bootstrap conventions unless there is a compelling architectural reason to change them.
6. Record material architecture changes as ADRs.

Do not work directly on `main` for Sprint 0B implementation.

## Canonical V1 domain model

At minimum, model these concepts:

- Organization
- Branch
- Client
- ClientContact
- Contract
- Site
- Post
- User
- Employee
- EmployeeRole
- Credential
- Certification
- Availability
- Shift
- ShiftAssignment
- ClockEvent
- TimeRecord
- ActivityEntry
- DailyActivityReport
- IncidentReport
- IncidentParticipant
- IncidentAttachment
- Handoff
- Asset
- AssetAssignment
- AssetCheckoutEvent
- AuditEvent
- BillingRate
- BillingPeriod
- BillableTimeRecord

Use normalized relationships and stable IDs. Avoid duplicating the same business fact across entities unless a deliberate snapshot/audit requirement justifies it.

### Core relationship direction

Organization
  -> Branch
      -> Client
          -> Site
              -> Post
                  -> Shift
                      -> ShiftAssignment

Employee
  -> Credential / Certification
  -> Availability
  -> ShiftAssignment

Shift
  -> ClockEvent
  -> ActivityEntry
  -> IncidentReport
  -> Handoff
  -> TimeRecord

Client
  -> Contract
  -> Site
  -> BillingRate
  -> ClientContact

Asset
  -> Assignment / Checkout History
  -> Employee or Site where applicable

## Minimum entity expectations

Field names may follow framework/database conventions while preserving business meaning.

### Organization
- id
- name
- status
- created/updated timestamps

### Branch
- organizationId
- name
- timezone
- status

### Client
- organizationId
- branchId where applicable
- name
- status
- billing/reporting configuration references

### Site
- clientId
- name
- address
- timezone
- latitude/longitude where useful for later geofence work
- geofence configuration
- active status

### Post
- siteId
- name
- description
- service type
- armed/unarmed requirement
- qualification requirements
- active status

### Employee
- organizationId
- userId where applicable
- employee number
- employment status
- primary branch
- contact/profile references

### Credential / Certification
- employeeId
- type
- issuing authority
- issued date
- expiration date
- status
- optional document reference

### Shift
- postId
- scheduled start/end
- status
- staffing requirement

### ShiftAssignment
- shiftId
- employeeId
- assignment status
- assigned timestamps

### ClockEvent
- shiftAssignmentId
- event type
- timestamp
- geolocation
- verification status
- exception reason

### ActivityEntry
- shiftAssignmentId
- timestamp
- category
- location/post
- structured description
- action taken
- follow-up required
- incident-related indicator
- visibility classification

### IncidentReport
- siteId
- shiftAssignmentId where applicable
- incident number
- classification
- severity
- occurrence timestamp
- narrative
- actions taken
- emergency-service involvement
- external case/report number
- status
- supervisor acknowledgement
- visibility classification

### Handoff
- shiftAssignmentId
- unresolved issues
- equipment/key status
- follow-up items
- submitted timestamp

### Asset
- organizationId
- asset type
- serial/identifier
- status
- condition
- assigned site/employee where applicable
- inspection/expiration dates where applicable

### BillingRate / BillableTimeRecord
Support rate configuration and validated billable operational time derived from actual approved work. Do not turn Nexus into a full accounting system.

### AuditEvent
Support actor, organization, action, entity type, entity ID, timestamp, request/session correlation where available, material before/after values where appropriate, and metadata.

## Service type model

Create an extensible service-type model for V1 static/uniformed services. Examples may include:

- `site_security`
- `armed_site_security`
- `access_control`
- `event_security`
- `fire_watch`
- `other_uniformed_service`

Do not hard-code around a specific client or site. Do not introduce vehicle-patrol behavior.

## Tenancy and data isolation

Assume multiple provider organizations may eventually exist even if the initial deployment contains one.

Required boundaries:

### Organization
Data from one provider organization must not be accessible to another.

### Client
Client users may access only explicitly authorized clients/sites.

### Site
Client/site access must be enforceable server-side, not merely hidden by UI.

### Employee
Guard-level users may access only information required for their assignments and explicitly permitted history.

### Operations
Operations users are scoped by organization/branch responsibilities.

### Leadership/Admin
Broader access remains explicitly permission-controlled.

Document the tenant strategy.

Never trust a client-supplied tenant, organization, client, branch, or site identifier by itself as authorization.

## RBAC and authorization

Initial roles:

- `GUARD`
- `SUPERVISOR`
- `OPERATIONS_MANAGER`
- `CLIENT_USER`
- `LEADERSHIP`
- `ADMIN`

Authorization must consider role plus scope where applicable:

- organization
- branch
- client
- site
- employee/self

Role alone is not sufficient.

Centralize permissions. Avoid scattered string comparisons or page-specific authorization logic.

Initial capabilities should include equivalents of:

- VIEW_OWN_ASSIGNMENTS
- CLOCK_OWN_SHIFT
- CREATE_ACTIVITY_ENTRY
- CREATE_INCIDENT
- SUBMIT_HANDOFF
- VIEW_SITE_OPERATIONS
- MANAGE_SHIFT_ASSIGNMENTS
- ACKNOWLEDGE_INCIDENT
- APPROVE_TIME
- VIEW_EMPLOYEE_COMPLIANCE
- VIEW_CLIENT_REPORTS
- VIEW_CLIENT_INCIDENTS
- VIEW_ORGANIZATION_ANALYTICS
- VIEW_BILLING_DATA
- MANAGE_CLIENTS
- MANAGE_SITES
- MANAGE_POSTS
- MANAGE_EMPLOYEES
- MANAGE_ASSETS
- MANAGE_ROLES

Exact permission names may follow project conventions while preserving the intended capability boundaries.

Create centralized authorization logic that can answer questions equivalent to:

- Does this actor possess the required capability?
- Is the target record inside the actor's authorized organization scope?
- Is it inside the actor's authorized branch/client/site scope?
- Is the record's visibility classification permitted for this actor?
- For self-service operations, does the record belong to the authenticated employee?

The application must not depend on UI route visibility as its security boundary.

## Visibility classification

Create an explicit information-visibility model for operational records with equivalents of:

- `INTERNAL`
- `SUPERVISOR`
- `CLIENT_VISIBLE`
- `EXECUTIVE`
- `RESTRICTED`

Do not assume a client user may see every operational record associated with that client's site.

Visibility rules must be enforceable by authorization logic rather than presentation-only filtering.

## Audit requirements

The audit foundation must be capable of tracking at least:

- login/security events
- clock record edits
- incident edits
- report submission
- incident acknowledgement
- schedule changes
- permission/role changes
- client-visibility changes
- billing-time approvals
- asset checkout/check-in

Audit records should support, where applicable:

- actor
- organization
- action
- entity type
- entity ID
- timestamp
- request/session correlation
- before state
- after state
- reason/comment
- metadata

Do not build a full audit-viewer UI in this sprint.

## Submitted record revision strategy

Submitted operational records must not be silently overwritten.

Support lifecycle concepts such as:

- draft
- submitted
- acknowledged/approved where applicable
- amended/corrected

Material changes after submission must preserve:

- who changed the record
- when the change occurred
- what changed
- why it changed

Avoid destructive history loss.

The architecture should distinguish between:
- editing a draft before submission
- correcting a submitted record
- acknowledging/approving a submitted record

Corrections to submitted records should create traceable revision history rather than replacing the original state without evidence.

## Persistence foundation

Use the persistence approach appropriate to the existing bootstrap.

If no database/ORM has been selected, choose a maintainable relational approach appropriate for:

- transactional integrity
- reporting
- tenancy
- auditability
- structured operational records
- future scaling

Prefer PostgreSQL-compatible architecture with a strongly typed schema/ORM appropriate to the existing TypeScript stack.

Do not add unnecessary cloud dependencies.

Create or establish:

- schema/models
- migration or migration-ready structure
- deterministic seed data
- database documentation

## Seed data

Use obviously fictional development data containing at minimum:

- 1 provider organization
- 1 branch
- 2 clients
- 2-3 sites
- multiple posts
- multiple employees with different roles
- credentials/certifications
- several shifts/assignments
- sample activity entries
- sample incident
- sample asset records

Seed data should exercise tenancy and authorization relationships, not merely populate isolated rows.

## Shared domain contracts

Centralize domain types, enums, constants, and authorization primitives where appropriate.

Keep clear boundaries between:

- persistence models
- domain/service logic
- transport/API contracts
- presentation components

Do not duplicate the same domain definition independently across UI and server layers unless there is a deliberate boundary-specific reason.

Do not prematurely create excessive abstraction.

Prefer simple, explicit domain contracts that can evolve safely in later sprints.

## Required documentation

Create or update:

- `docs/domain-model.md`
- `docs/authorization.md`
- `docs/tenancy.md`
- `docs/audit-model.md`
- `docs/data-classification.md`
- `docs/architecture.md`

Update the existing `docs/architecture.md` rather than creating a competing architecture document.

Include a Mermaid ERD if compatible with repository conventions.

Update README only where necessary.

## Architecture Decision Records

Create concise ADRs for material decisions such as:

- database / ORM selection
- tenancy strategy
- RBAC / permission architecture
- immutable or revisioned operational records

Do not create ADRs for trivial implementation details.

Use the repository's existing ADR convention if one exists.

If no ADR convention exists, establish a simple documented convention under an appropriate docs path.

## Required tests

At minimum verify:

1. A guard cannot access another guard's unauthorized assignment data.
2. A client user cannot access another client's records.
3. A client user cannot access INTERNAL or RESTRICTED records merely because they belong to that client's site.
4. An operations manager can access permitted operational records within scope.
5. Cross-organization access is denied.
6. Permission resolution uses centralized authorization logic.
7. Submitted/revised records preserve required history behavior.
8. Schema and seed integrity succeeds.
9. Existing tests continue to pass.

Tests should validate actual authorization behavior and not merely assert enum membership or static role tables.

## Security constraints

Design for least privilege.

Do not:

- store credentials or secrets in source
- expose tenant IDs as authorization mechanisms by themselves
- trust client-supplied organization/client/site identifiers without authorization
- rely on route hiding for access control
- introduce HIPAA or medical-data functionality
- introduce EP protected-person data
- implement production secrets
- weaken validation or tests to make the sprint pass

Update `.env.example` if new development configuration is required.

## Out of scope

Do not build:

- Guard dashboard UI
- scheduling UI
- Operations dashboard
- Client dashboard
- Leadership dashboard
- Asset-management UI
- Billing UI
- production authentication-provider integration unless strictly necessary for architecture foundation
- push notifications
- maps
- geofence execution logic
- offline synchronization
- Executive Protection
- vehicle patrol

These belong to later sprints.

## Acceptance criteria

Sprint 0B is complete only when all applicable items below are satisfied:

1. Canonical V1 domain model exists.
2. Entity relationships are documented.
3. Persistence/schema foundation exists.
4. Migration path exists.
5. Deterministic development seed data exists.
6. RBAC permissions are centralized.
7. Organization/client/site scoping is explicit.
8. Server-side authorization strategy is established.
9. Visibility classification exists.
10. Audit-event foundation exists.
11. Submitted-record revision strategy is established.
12. Cross-tenant and role authorization tests exist.
13. Documentation and ADRs exist.
14. Existing bootstrap functionality remains intact.
15. Formatting passes.
16. Lint passes.
17. Typecheck passes.
18. Unit tests pass.
19. Schema/migration validation passes.
20. Seed validation passes.
21. Production build passes.
22. No unnecessary V1 feature UI has been implemented.
23. No vehicle-patrol or EP functionality has been introduced.

## Verification

Run all applicable repository-standard checks, including:

- dependency/install integrity
- formatting check
- lint
- typecheck
- unit tests
- schema validation
- migration validation
- seed validation
- production build

Fix failures introduced by this sprint.

Do not:
- hide failing checks
- bypass validation
- disable tests
- comment out failing tests
- weaken assertions merely to obtain a passing result

## Scope and architecture drift check

Before delivery, explicitly report any:

- new dependency
- new infrastructure component
- schema concept not specified in this sprint
- new permission outside the authorization model
- feature implemented outside sprint scope

If none, report:

`No material architecture drift.`

For reversible implementation details:
- choose the least-complex reasonable approach
- document the decision

For material product, security, or architecture decisions not resolved by this specification:
- do not invent requirements
- surface them as unresolved decisions

## Git and delivery

- Work only on `feature/sprint-0b-domain-architecture`.
- Use coherent commits.
- Do not merge directly to `main`.
- Push the feature branch when complete.
- Open a **draft** pull request into `main`.
- Include validation results, architecture drift, assumptions, and unresolved decisions in the PR description.
- Do not merge the PR.

## Required Codex output

Return only:

1. Repository confirmed
2. Branch
3. Architecture summary
4. Persistence/ORM decision
5. Domain entities created
6. RBAC model
7. Tenant isolation strategy
8. Audit/revision strategy
9. Files added/changed
10. Tests added
11. Validation results
12. Architecture drift result
13. Draft PR URL
14. Assumptions made
15. Risks/unresolved decisions
16. Anything requiring a decision before Sprint 1

## Final ingestion instructions

This is the final specification chunk.

Before creating the target file:

1. Verify that all seven chunk markers were received:
   - NEXUS-0B-01-BEGIN / END
   - NEXUS-0B-02-BEGIN / END
   - NEXUS-0B-03-BEGIN / END
   - NEXUS-0B-04-BEGIN / END
   - NEXUS-0B-05-BEGIN / END
   - NEXUS-0B-06-BEGIN / END
   - NEXUS-0B-07-BEGIN / END

2. Verify the chunks are sequential and none are missing.

3. Concatenate only the content between each BEGIN and END marker, in numeric order.

4. Write the resulting complete specification to:
   `docs/sprints/sprint-0b.md`

5. Confirm the final file ends with this exact integrity marker:

`END-NEXUS-SPRINT-0B-SPEC`

6. Commit and push only the documentation change to `main`.

7. Verify the remote path exists at:
   `docs/sprints/sprint-0b.md`

8. Stop after verification.

Do not begin Sprint 0B implementation yet.

## Integrity marker

END-NEXUS-SPRINT-0B-SPEC
