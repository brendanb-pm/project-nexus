# Architecture

Project Nexus uses the Next.js App Router, React, TypeScript, and Tailwind CSS. Route composition lives in `src/app`; reusable presentation in `src/components`; business boundaries in `src/features`; cross-cutting types in `src/shared`; and provider-facing code in `src/services`.

## Security boundaries

- Authentication is a server-enforced boundary; no provider is selected in the bootstrap.
- Authorization uses explicit roles and deny-by-default policies at server entry points.
- Every client-owned record must carry a tenant identifier, and service/repository APIs must require tenant context.
- Security-relevant mutations will emit append-only audit events with actor, tenant, action, target, and timestamp.
- Secrets remain server-only and are never exposed through `NEXT_PUBLIC_*` variables.
- V1 must not store HIPAA/medical data.

## PWA foundation

The web manifest, responsive shell, theme metadata, and placeholder vector icon establish installability primitives. Offline synchronization and caching are intentionally deferred until data-conflict and secure-storage policies are designed.

## Planned boundaries

V1 domains are scheduling, reporting, incidents, operations, clients, billing support, and assets. Executive Protection is a separately designed V2 module and must not share accidental workflow assumptions with V1.
