# ADR 0006: Generic OIDC Authentication Adapter

- Status: Accepted
- Date: 2026-08-23

## Context

Sprint 0B established a provider-neutral authenticated request boundary but no production session or external identity mechanism. NX-1.1 must become usable without making a provider's groups or claims the Nexus authorization store.

## Decision

Use Better Auth 1.7 with its generic OpenID Connect integration and database-backed PostgreSQL sessions. Bind the verified issuer/subject to an internal Nexus user through an additive external-identity table. Resolve active membership, roles, scopes, capabilities, and visibility from Nexus tables for each request.

## Consequences

- Any conforming OIDC provider can be configured without changing feature code.
- PKCE, OIDC token validation, session revocation, and provider logout use a maintained authentication library rather than custom protocol code.
- Deployments require an OIDC client and documented environment values.
- Four isolated auth tables and two Nexus binding/membership tables are added.
- Unknown external identities cannot acquire a Nexus request context without pre-provisioning.
- Enterprise federation, SCIM, multi-provider selection, and IAM UI remain out of scope.
