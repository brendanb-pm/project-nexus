# NX-1.2 Readiness

Authentication and membership resolution leave NX-1.2 technically unblocked:

- `MANAGE_CLIENTS` remains the centralized mutation capability.
- Authoritative organization and branch scopes are available in the request context without browser-supplied tenant claims.
- Organization-wide administrators and branch-scoped operators can be distinguished server-side.
- Audit actor and session correlation are authoritative.
- No authentication-provider claim is used as client visibility authority.

The following Sprint 1 product decisions still require Brendan before NX-1.2:

1. Contact lifecycle: add an explicit active/inactive status or define another non-destructive representation.
2. Contract lifecycle: approve the V1 status vocabulary.
3. Contract overlap: decide whether multiple active contracts may overlap for a client.
4. Client visibility: confirm that client users remain read-only and receive no administration capability in NX-1.2.

No Client, ClientContact, or Contract feature implementation is included here.
