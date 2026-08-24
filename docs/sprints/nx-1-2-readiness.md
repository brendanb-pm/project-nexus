# NX-1.2 and NX-1.3 Decisions

Authentication and membership resolution leave NX-1.2 technically unblocked:

- `MANAGE_CLIENTS` remains the centralized mutation capability.
- Authoritative organization and branch scopes are available in the request context without browser-supplied tenant claims.
- Organization-wide administrators and branch-scoped operators can be distinguished server-side.
- Audit actor and session correlation are authoritative.
- No authentication-provider claim is used as client visibility authority.

The execution brief approved least-complex reversible defaults for the previously open decisions:

1. Contacts use explicit `active`/`inactive` status and are never hard-deleted.
2. Contract lifecycle is `draft`, `active`, `expired`, or `terminated`; dates are explicit and must be ordered.
3. Active contracts for one client may not have overlapping effective ranges because V1 has no narrower service-scope discriminator.
4. Client users remain read-only, and centralized scope prevents access outside their authorized client context.
5. Client deactivation is blocked while active contracts or sites remain. Site deactivation is blocked by active posts, future/active shifts, or assigned active assets; Post deactivation is blocked by future/active shifts.
6. Site and Post parent relationships are immutable through these administration forms. A future explicit reassignment workflow would require its own audit and dependency policy.

## Human-factors review

- **FIXED:** Client, branch, site, and post selection uses bounded, human-readable labels; no routine form asks an operator to type a persistence ID.
- **FIXED:** lifecycle controls say Active/Inactive and preserve historical records rather than presenting destructive deletion.
- **FIXED:** Site context is preserved while managing its first-class Posts.
- **JUSTIFIED POWER-USER INPUT:** IANA timezone, coordinates, and newline-delimited qualification names are domain configuration values, not persistence/security identifiers.
- **DEFERRED WITH REASON:** server-side search beyond the first bounded page is deferred until representative directory volume requires it; the UI reports when additional pages exist.

## Performance evidence boundary

Deterministic tests verify 25-row primary pages, 100-row related-detail ceilings, and constant repository calls as fixtures grow. Normal composed pages use at most five feature database round trips, with independent top-level reads and related detail reads parallelized. Live database duration and end-to-end p95 measurements remain unclaimed until a production-like PostgreSQL environment and shared instrumentation harness exist.

No NX-1.4, NX-1.5, scheduling, patrol, Executive Protection, map, or geofence-execution behavior is included.
