# ADR 0007: Scheduling and timekeeping integrity

**Status:** Accepted

## Context

Scheduling joins tenant hierarchy, employee eligibility, civil-time interpretation, location evidence, corrections, and approval. Treating mutable rows as history or trusting client time/identity would make time evidence irreproducible.

## Decision

Use the existing authenticated data-access, capability/scope authorization, audit, revision, PostgreSQL/Drizzle, eligibility, pagination, and telemetry boundaries. Store scheduled and clock times as instants with explicit timezone context. Reject ambiguous civil time without disambiguation. Model availability and assignment overlap as half-open intervals.

Clock events are append-only and use server-authoritative occurrence time. A submitted point and accuracy are retained only as event evidence; no continuous tracking occurs. Corrections append immutable effective-time revisions and invalidate approval. Time approval is a distinct immutable transition, and the corrector of a resulting revision cannot approve it.

## Consequences

Current-state reads remain efficient while event/revision history can reconstruct who changed or approved time, when, and why. Exceptions preserve evidence rather than discarding employee actions. Payroll, automatic deductions, recurrence, patrol, and Executive Protection remain outside this boundary.
