# Reporting domain

## Guard-facing taxonomy and authority

Guards use two reporting choices: **Shift Report** and **Security Incident Report**. Shift Report is one composed workflow: its chronological timeline is built from canonical `ActivityEntry` records and its final closeout/passdown state is stored in canonical `EndOfShiftReport` (EOSR) persistence. Security Incident Report is the formal exception/escalation workflow and may link to a relevant `ActivityEntry` and Shift Report context.

`ActivityEntry`, `IncidentReport`, and EOSR remain separate technical record and persistence boundaries. EOSR is not a separate guard-facing report product. Each family owns its own lifecycle; Nexus does not introduce a polymorphic reporting table, a competing Shift Report table, or a generic report builder.

`daily_activity_reports` is retained as legacy evidence only. It has no active writer or authoritative read model. A future daily aggregate, if approved, must be derived from canonical `activity_entries` rather than reactivate this table.

An `IncidentReport` may reference its originating `ActivityEntry` but never replaces it. Incident participants and attachment storage are separate follow-up responsibilities; attachment storage is not an authority dependency for the reporting lifecycle.

EOSR is the sole new end-of-shift submission and the final closeout section of Shift Report. Its existing authoritative fields are shift summary, unresolved issues, equipment/access condition, follow-up items, unusual conditions, and passdown. It summarizes material conditions and turnover information; it does not duplicate the ActivityEntry timeline. Passdown is delivered only through authorized current/next assignment context. Historical `handoffs` are preserved as read-only submission history: they remain readable, reviewable, and amendable through the existing revision/audit path, but have no new submission writer.

## Compatibility and route transition

Today `/reporting` and `/eosr` remain separate compatible routes. NX-8.1 does not consolidate, redirect, or remove either route. NX-8.2 supplies the Shift Report activity timeline and NX-8.4 supplies its EOSR-backed closeout/passdown section; NX-8.6 owns the Reporting Hub and the approved route transition. Only after those components preserve authorization, deep links, history, and error/retry behavior may `/eosr` become a compatibility redirect or embedded closeout entrypoint. Historical Handoff access remains available throughout.

## Lifecycle, history, and visibility

Server-derived assignment, site, post, tenant, actor, timestamp, visibility, and idempotency context govern all new submissions. The original submitted record is immutable. Acknowledgement and amendment are authorized lifecycle actions; amendments append a revision snapshot and audit evidence instead of overwriting the original.

Client access is default-deny. Guards can submit only for their own authorized assignment. Supervisors and Operations users may receive only hierarchy- and visibility-scoped review actions. Missing ownership or a late/unavailable record is represented truthfully rather than inferred from an empty or unauthorized result.

## Timekeeping and deferred scope

`TimeRecord` and approved timekeeping remain the authority for payroll-adjacent evidence. Reporting does not calculate payroll, wages, tax, overtime, or export files.

This boundary does not add report forms, drafts, offline/deferred sync, a reporting hub, generic exports, BambooHR integration, incident participants, or attachment storage. Those require their separately approved stories.
