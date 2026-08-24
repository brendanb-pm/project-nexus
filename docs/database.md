# Database

Project Nexus uses a PostgreSQL-compatible relational schema defined with Drizzle ORM in `src/server/db/schema.ts`. Generated SQL migrations are committed under `drizzle/` and must be applied in order by deployment tooling selected later.

Commands:

```bash
npm run db:generate
npm run db:check
npm run db:seed:validate
```

`db:generate` creates migrations from schema changes, `db:check` validates migration history consistency, and `db:seed:validate` verifies deterministic fictional fixtures and their relationships without requiring a running database. The fixture module is development/test input, not a production seeding policy.

`DATABASE_URL` is server-only. The example value is local-only and contains no credential intended for deployment.

Runtime access is centralized in `src/server/db/client.ts`. NX-1.1 organization/branch repositories select only boundary DTO fields, include the authoritative organization predicate, use stable name/ID cursor ordering, cap pages at 100 records, and write the business mutation plus audit event in one transaction. The existing branch organization index supports the tenant predicate; a composite sort index is deferred until representative measurements justify it.

NX-1.2 and NX-1.3 add only the persistence constraints required by the approved administration workflows: non-destructive contact status, constrained contract lifecycle/date ordering, and composite parent/name/ID indexes for bounded Client → Site → Post reads. Client pages default to 25 rows; selected-client contacts/contracts and selected-site posts are capped at 100. Related detail reads are set-oriented and independent reads execute in parallel, so query count does not grow with result size. Active-contract overlap and lifecycle dependency checks run inside the mutation transaction with the audit insert.

Authentication adds isolated `auth_*` protocol/session tables plus `external_identities` and `user_memberships`. The external binding is the verified OIDC issuer/subject pair; email is never a binding key. Authentication sessions use text IDs owned by Better Auth, while Nexus domain records retain UUIDs. The additive migration can be rolled back before production use by dropping the new foreign keys, indexes, and tables in reverse dependency order.

NX-1.4 adds a unique optional `employees.user_id` link. Employee/User association is explicit and organization-scoped; it does not create an external identity or active membership. NX-1.5 adds verification metadata, predecessor references, date/status constraints, and employee/type/expiry indexes to the existing normalized credential and certification tables. The history link is service-enforced because a renewal must also prove matching employee and record kind inside the authorized transaction.
