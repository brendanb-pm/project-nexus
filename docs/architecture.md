# Architecture

Project Nexus uses the Next.js App Router, React, TypeScript, Tailwind CSS, Drizzle ORM, and PostgreSQL. Route composition lives in `src/app`; reusable presentation in `src/components`; business boundaries in `src/features`; canonical contracts in `src/domain`; server-only persistence in `src/server`; cross-cutting types in `src/shared`; and provider-facing code in `src/services`.

## Layer boundaries

- Persistence models describe relational storage and remain inside `src/server/db`.
- Domain contracts and pure policy logic do not depend on React, transport, or a database connection.
- API/transport code must authenticate the actor, load authoritative scope, invoke centralized authorization, and only then call repositories.
- Presentation code receives already-authorized, boundary-specific contracts; it is never the security boundary.
- Server Components are the default for future data access. Server-only persistence modules must not enter client bundles.

## Authenticated request and data access

`src/server/request` is the shared server boundary for feature reads and mutations. A provider-neutral principal resolver supplies the authenticated actor and session metadata; the boundary derives organization and narrower scopes, centralized capabilities, permitted visibility, correlation data, and immutable audit attribution. Feature services receive this trusted context and never accept a caller-selected tenant as authority.

`src/server/db/client.ts` is the lazy server-only PostgreSQL/Drizzle connection boundary. Feature repositories must require authoritative organization scope in every query, return minimal DTOs, keep collection reads bounded, and transact material mutations with their audit event.

Authentication uses a generic OpenID Connect adapter behind the Sprint 0B `PrincipalResolver`. Better Auth owns protocol validation and revocable session storage. Nexus resolves the verified issuer/subject to its own active user, membership, employee relationship, scoped role assignments, capabilities, and visibility on every new server request. Feature code receives only the provider-neutral authenticated request context.

Sprint 1 administrative services reuse this boundary for Client, ClientContact, Contract, Site, and Post operations. Browser identifiers are lookup hints only: repositories load the authoritative parent hierarchy with organization/scope predicates, services authorize the resolved branch/client/site, and mutations retain the original parent where relationship changes are prohibited. Client users may read only authorized client context and have no administrative mutation capability. Post remains a first-class staffed-position entity below Site.

## Security boundaries

- Authentication is a server-enforced, generic OIDC boundary; provider configuration remains isolated from application authorization.
- Authorization uses explicit capabilities plus authoritative organization, branch, client, site, employee, and visibility scope at server entry points.
- Every client-owned record must carry a tenant identifier, and service/repository APIs must require tenant context.
- Security-relevant mutations will emit append-only audit events with actor, tenant, action, target, and timestamp.
- Submitted operational records use immutable revision snapshots linked to audit events; corrections require a reason.
- Secrets remain server-only and are never exposed through `NEXT_PUBLIC_*` variables.
- V1 must not store HIPAA/medical data.

## PWA foundation

The web manifest, responsive shell, theme metadata, and placeholder vector icon establish installability primitives. Offline synchronization and caching are intentionally deferred until data-conflict and secure-storage policies are designed.

## Planned boundaries

V1 domains are scheduling, reporting, incidents, operations, clients, billing support, and assets. Executive Protection is a separately designed V2 module and must not share accidental workflow assumptions with V1.

## Decisions

Material decisions are recorded under [`docs/adr`](adr/README.md). See also the [domain model](domain-model.md), [authorization](authorization.md), [tenancy](tenancy.md), [audit model](audit-model.md), [classification](data-classification.md), and [database](database.md) guides.
