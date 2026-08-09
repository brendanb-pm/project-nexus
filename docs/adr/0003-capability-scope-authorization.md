# ADR 0003: Capability and scope authorization

**Status:** Accepted

## Context

Role-only checks cannot express tenant, site, visibility, or self-service boundaries.

## Decision

Resolve roles to centralized capabilities, then evaluate organization, branch, client, site, employee/self, and visibility scope in one authorization service.

## Consequences

Server entry points have a single policy boundary. New capabilities require deliberate central review and behavioral tests; route hiding remains presentation-only.
