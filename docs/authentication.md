# Authentication and Membership

## Approved mechanism

Project Nexus uses Better Auth with one standards-based OpenID Connect provider configuration. OIDC-specific behavior is confined to `src/auth/server.ts` and the session verifier. The application boundary continues to consume the provider-neutral `PrincipalResolver` contract.

The provider authenticates a person. It does not authorize Nexus access.

## Resolution flow

1. Better Auth validates the OIDC authorization-code flow using discovery, issuer and ID-token validation, nonce, state, and PKCE.
2. Provider token material is encrypted at rest and a database-backed Better Auth session is issued in a secure HTTP-only cookie.
3. The server validates that session for a request and obtains only the local authentication-user and session identifiers.
4. The membership resolver joins the provider account's authoritative issuer/subject to a pre-provisioned Nexus external-identity binding.
5. Nexus requires an active user, active provider organization, active membership, and (when linked) active employee.
6. Nexus loads at most 100 scoped employee-role assignments, rejects invalid or cross-organization scopes, and derives roles, capabilities, and visibility through the centralized Sprint 0B authorization module.
7. One immutable request context is reused by feature services and audit writes.

Unknown identities, missing/revoked sessions, inactive users or memberships, ambiguous bindings, excessive role assignments, and invalid scope relationships all fail closed.

## Provisioning

Before a person can access Nexus, an administrator must provision:

- an internal Nexus `users` row;
- an `external_identities` row containing the provider's immutable issuer and subject (never email);
- an active `user_memberships` row for the same organization;
- an employee link and scoped employee-role assignments when applicable.

No self-service enrollment or IAM administration UI is included in this work.

## Session and logout behavior

Sessions are database-backed and checked on every request; cross-request session or membership caching is intentionally disabled. Revoked or expired sessions therefore stop producing a Nexus request context. Local sign-out revokes the application session, and OIDC RP-initiated logout is used when the discovery document advertises an end-session endpoint.

Sessions last up to 12 hours, refresh no more than hourly, and use a 15-minute freshness window for future high-risk step-up policy. Routine administration in this story does not add a new step-up requirement.

## Deployment configuration

Required server configuration:

- `BETTER_AUTH_SECRET`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `OIDC_ISSUER`
- `OIDC_DISCOVERY_URL`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`

Register `${NEXT_PUBLIC_APP_URL}/api/auth/callback/nexus-oidc` as the provider callback and `${NEXT_PUBLIC_APP_URL}/sign-in` as an allowed post-logout return. Use HTTPS outside local development. Secrets belong in the deployment secret store, not source control.
