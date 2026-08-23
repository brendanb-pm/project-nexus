# ADR 0001: PostgreSQL and Drizzle ORM

**Status:** Accepted

## Context

Nexus requires transactional integrity, structured reporting, typed schema evolution, tenant boundaries, and auditable relationships without a cloud dependency.

## Decision

Use PostgreSQL-compatible SQL with Drizzle ORM and checked-in generated migrations.

## Consequences

The schema remains explicit and TypeScript-aware. Operations must provide PostgreSQL and migration execution later. Drizzle ORM, Drizzle Kit, `pg`, and local TypeScript execution tooling are added dependencies.
