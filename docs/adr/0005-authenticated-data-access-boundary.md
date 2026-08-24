# ADR 0005: Authenticated data-access boundary

**Status:** Accepted

## Context

Feature services need one provider-neutral way to receive authenticated identity, tenant/scope grants, capabilities, visibility, correlation, and audit attribution before repositories proliferate.

## Decision

Resolve authentication through an injected `PrincipalResolver`, derive one immutable request context from the Sprint 0B authorization model, and require feature services to use `AuthorizedDataAccess` before calling organization-scoped repositories. Keep PostgreSQL/Drizzle construction in a lazy server-only database module.

## Consequences

No browser-supplied tenant ID grants authority, feature repositories receive authoritative scope, and a future authentication provider can integrate without changing domain services. Until that adapter is selected, live routes fail closed while services and UI states remain testable through injected resolvers.
