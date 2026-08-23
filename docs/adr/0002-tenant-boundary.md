# ADR 0002: Organization-rooted tenancy

**Status:** Accepted

## Context

Provider organizations require hard isolation while branch, client, site, and employee responsibilities narrow access further.

## Decision

Treat `Organization` as the tenant root. Derive authorization scope from authenticated server-side grants and authoritative record relationships; never trust caller-selected IDs alone.

## Consequences

Queries and mutations require organization context and narrower predicates. PostgreSQL RLS is deferred until deployment connection identity is known.
