# Sprint 3 — Daily activity, incidents, and handoff

**Status:** In progress  
**Stories:** NX-3.1 through NX-3.5  
**Integrity marker:** `NX-SPRINT-3-DAR-INCIDENT-HANDOFF-V1`

## Outcome and boundaries

Sprint 3 adds structured, assignment-linked daily activity reporting, the reportable-incident gate and incident workflow, end-of-shift handoff, and supervisor acknowledgement or correction of operational records. The authenticated server context remains authoritative for the actor, tenant, hierarchy, and audit attribution; the browser supplies only lookup hints and operator-entered content.

Excluded are patrol, continuous GPS tracking, Executive Protection, payroll or tax, public client access to internal operational narratives, and Sprint 4 or later work.

## Shared integrity rules

- Every read is organization- and hierarchy-scoped, bounded, and stably ordered. Related records load set-wise, with no N+1 query pattern.
- Material changes transact their operational record and append-only audit evidence together. Corrections create immutable revisions rather than overwriting historical content.
- Operational events derive Site, Post, Client, Branch, Organization, actor, and assignment context from trusted server-side relationships. Cross-tenant or forged identifiers are denied without existence disclosure.
- Collection reads default to 25 and cap at 100. Operational telemetry records aggregate timing, query count, row count, payload size, and outcome only; it never records tenant, actor, location, session, narrative, or query text.

## NX-3.1 — Structured DAR activity entries

An assigned employee can submit a structured activity entry only against an authoritative, non-cancelled assignment that belongs to that employee and hierarchy. Nexus derives the Site and Post and records a server-authoritative occurrence time. Category, concise narrative, optional location context, action taken, follow-up flag, and internal visibility are validated server-side. A per-assignment submission key makes safe retry idempotent without relying on client-selected record IDs.

## NX-3.2 — Reportable incident gate

The activity workflow identifies whether a report is required based on explicit, deterministic operational categories. The gate explains the required next action without automatically creating, suppressing, or exposing an incident record.

## NX-3.3 — Incident workflow

Authorized employees can create an assignment-linked incident report only through trusted hierarchy context. The workflow supports factual classification, severity, occurrence time, narrative, immediate actions, optional emergency-service indicator, and explicit lifecycle state. Supervisor acknowledgement, correction history, and client-safe views preserve operational confidentiality.

## NX-3.4 — End-of-shift handoff

An employee may submit a handoff for their assignment with unresolved issues, equipment/key status, follow-up items, and a trusted submission timestamp. Handoffs are scoped to the operational hierarchy and retain immutable audit evidence.

## NX-3.5 — Supervisor acknowledgement and corrections

Authorized supervisors may acknowledge eligible operational records in their hierarchy. Corrections require a reason, optimistic concurrency where applicable, and append-only revision/audit history. The originating employee cannot use correction or acknowledgement authority outside their granted role.

## Acceptance and verification

Each story covers successful authorized operation, cross-tenant and cross-hierarchy forged identifiers, client-user mutation denial, trusted context derivation, audit evidence, bounded reads, retry safety where applicable, and compact responsive UI states. Sprint closure includes migration application on safe non-production PostgreSQL, representative runtime measurements, a proportional regression suite, and production build verification. Server measurements do not claim browser or network latency.
