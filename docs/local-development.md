# Local development runtime

Project Nexus runs its local PostgreSQL service in Docker on
`127.0.0.1:5434`. The application uses the resettable `nexus_demo` database;
the container also creates `nexus_dev` for non-demo development work.

```powershell
Copy-Item .env.example .env.local
docker compose up -d
npm ci
npm run db:migrate
npm run db:demo:reset
npm run dev
```

`db:demo:reset` is intentionally destructive only for the exact local
`nexus_demo` target. It refuses every other database host or database name.
Run it whenever a deterministic demo state is needed.

## Local demo identities

Set `NEXUS_DEV_AUTH=true` in `.env.local` only. When `NODE_ENV=development`
and `NEXT_PUBLIC_APP_URL` is `localhost` or `127.0.0.1`, the sign-in page
exposes two signed, HTTP-only local sessions:

- Guard A, scoped to Cedar Plaza North / North Lobby.
- Operations Manager B, scoped to Northstar Central review operations.

The development adapter maps these fixed local auth accounts through the same
Nexus membership and role resolver as production. It is unavailable outside
that explicit local-development gate; production Better Auth OIDC behavior is
unchanged.

## Troubleshooting and teardown

Use `docker compose ps` to check PostgreSQL health and `docker compose logs
nexus-postgres` to inspect startup failures. Confirm `DATABASE_URL` in
`.env.local` points to `localhost:5434/nexus_demo`, then rerun migration and
the guarded reset.

Use `docker compose down` to stop the service without losing data. Use
`docker compose down -v` only when intentionally removing the local Nexus
database volume; run migrations and the demo reset again afterward.
