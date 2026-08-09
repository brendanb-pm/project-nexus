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
