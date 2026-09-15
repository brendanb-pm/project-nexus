# Local development runtime

Project Nexus runs its local PostgreSQL service in Docker on
`127.0.0.1:5434`. The application uses the resettable `nexus_demo` database;
the container also creates `nexus_dev` for non-demo development work.

```powershell
pwsh -File .\scripts\dev\Setup-DockerPostgres.ps1 -Phase Provision
npm.cmd run dev
```

If Docker Desktop was deliberately installed for all Windows users, add
`-AllowAllUsersInstall`; the default blocks so an unexpected machine-wide
installation is never silently accepted.

The setup script generates independent Nexus/Atlas database credentials with
Windows DPAPI, writes only ignored local environment files with a
current-user-only ACL, starts the `nexus-local` Compose project, and verifies
the migration rerun is a no-op. It never connects to or modifies a Windows
PostgreSQL service.

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

Use `docker compose --env-file .env.docker.local ps` to check PostgreSQL health
and `docker compose --env-file .env.docker.local logs nexus-postgres` to inspect
startup failures. Confirm `DATABASE_URL` in
`.env.local` points to `localhost:5434/nexus_demo`, then rerun migration and
the guarded reset.

Use `docker compose --env-file .env.docker.local down` to stop the service
without losing data. Volume deletion is intentionally absent from the normal
setup and verification workflow.
