# Project Nexus

Project Nexus is a responsive physical security operations platform. V1 is focused specifically on uniformed site protection and establishes a secure, tenant-aware foundation before workflow development.

## V1 scope and exclusions

V1 covers scheduling, shift assignments, clock in/out, Daily Activity Reports, incident reporting, end-of-shift reporting, operations management, client reporting, billing support, and asset management.

V1 explicitly excludes vehicle patrol workflows, Executive Protection (EP) workflows, HIPAA/medical-data storage, travel routing, and EP mission management. EP is planned as a separately designed V2 module; see [the V2 boundary](docs/v2-ep-boundary.md).

## Stack

Next.js App Router, React, strict TypeScript, Tailwind CSS, ESLint, Prettier, Vitest, Testing Library, and Playwright. The PWA foundation includes a web manifest, install metadata, responsive application shell, and placeholder icon. Complex offline synchronization is deferred.

Persistence uses Drizzle ORM with a PostgreSQL-compatible schema. Sprint 0B establishes models, migrations, deterministic fixtures, authorization, tenancy, audit, and revision foundations without adding feature UI.

## Local setup

Requires Node.js 22+ and npm.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`. Never commit `.env.local` or credentials. Only browser-safe values may use the `NEXT_PUBLIC_` prefix; keep authentication, database, and provider secrets server-only.

## Commands

```bash
npm run dev          # local development
npm run lint         # ESLint
npm run typecheck    # strict TypeScript
npm test             # unit tests
npm run test:e2e     # Playwright (install browsers first)
npm run build        # production build
npm run format:check # formatting verification
npm run db:check     # migration consistency
npm run db:seed:validate # deterministic seed integrity
```

## Branching

- `main`: production-intended integrated code
- `feature/<name>`: normal V1 development
- `fix/<name>`: fixes
- `docs/<name>`: documentation
- `experimental/<name>`: unapproved exploratory work

Do not place experimental or incomplete functionality on `main`. Do not introduce V2/EP implementation into `main` without explicit authorization.

## Architecture

The App Router composes routes in `src/app`. Reusable UI belongs in `src/components`, domain code in `src/features`, authentication/authorization in `src/auth`, shared contracts in `src/shared`, and external access behind `src/services`. Client data must be tenant-scoped, permissions enforced server-side, and security-relevant activity auditable. See [architecture](docs/architecture.md) and [V1 scope](docs/v1-scope.md).
