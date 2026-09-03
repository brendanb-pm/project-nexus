# Windows engineering workstation bootstrap

This is the repeatable local-development bootstrap for Project Nexus on a Windows engineering workstation. It is intentionally localhost-first, keeps all secrets in untracked `.env.local`, and uses the repository's isolated Docker PostgreSQL service.

## Supported baseline

- Windows 10/11 with virtualization enabled in firmware.
- WSL2 with Ubuntu 24.04 LTS (Ubuntu 22.04 LTS also works where required by a managed Windows image).
- Docker Desktop using Linux containers, the WSL2 backend, and Ubuntu integration.
- Git, Node.js 22 LTS or later, and npm.
- At least 16 GB RAM and 30 GB available SSD space are recommended for Docker, Node dependencies, and browser tests.

The procedure has no machine-name, username, or Dell-specific dependency. Use it unchanged on the MSI; only the path argument may differ.

## Phase 1: Windows platform prerequisites

Open an elevated PowerShell only if Windows prompts for elevation. Install Ubuntu and set WSL2 as the default:

```powershell
wsl --install --distribution Ubuntu-24.04 --web-download
wsl --set-default-version 2
```

Restart only if Windows requests it. On first Ubuntu launch, create the Linux user when prompted. Install Docker Desktop using its supported installer and enable **Use the WSL 2 based engine**, Linux containers, and Ubuntu integration. Do not expose the Docker daemon remotely.

## Phase 2: bootstrap Nexus

From a regular PowerShell in any clone of Nexus:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev\bootstrap-windows.ps1 -Phase Prerequisites
powershell -ExecutionPolicy Bypass -File .\scripts\dev\bootstrap-windows.ps1 -Phase Nexus -WorkspaceRoot C:\Projects -ResetDemo
```

`-ResetDemo` is intentionally explicit. Omit it for normal workstation startup. The script creates `C:\Projects\project-nexus` only when it does not exist, fetches and fast-forwards `main`, creates `.env.local` only if absent, and never writes a GitHub token or password.

When Git asks for authentication, use Git Credential Manager's browser/device flow. The account must have repository write access if the workstation will push branches; do not paste access tokens into scripts or `.env.local`.

The initial local `.env.local` enables only localhost development personas and generates a local Better Auth secret. It remains untracked. Production OIDC configuration is not changed.

## Daily workflow

```powershell
Set-Location C:\Projects\project-nexus
docker compose up -d
npm.cmd run db:migrate
npm.cmd run dev
```

Open `http://localhost:3000`. Use `docker compose down` to stop PostgreSQL. Use `npm.cmd run db:demo:reset` only when intentionally returning `nexus_demo` to deterministic demo data; the script rejects non-local and non-`nexus_demo` targets.

For a LAN demonstration, make an explicit, temporary developer choice to run `npm.cmd run dev -- --hostname 0.0.0.0` and configure only the minimum scoped firewall rule required by the managed network. Do not create public tunnels or permanently broaden firewall access.

## Verify a workstation

After Docker is running, Nexus is bootstrapped, and the development server is started, run:

```powershell
.\scripts\dev\verify-workstation.ps1 -RepoPath C:\Projects\project-nexus
```

It reports PASS/FAIL for WSL, Ubuntu, Git/remote read access, Node/npm, Docker and Linux containers, Nexus workspace/configuration, PostgreSQL, migration and seed contracts, and HTTP readiness. It never prints `.env.local` contents or credentials.

## Local smoke test

With `NEXUS_DEV_AUTH=true` in local `.env.local`, open `/sign-in` and use Guard A. Confirm Current Shift, Schedule, Timecard, Reporting/DAR, and EOSR render. Sign out, then use Operations Manager B and confirm `/operations` and **Needs Attention** render without a runtime error. The demo database is local-only at `127.0.0.1:5434`; `nexus_dev` is for non-demo work and `nexus_demo` is the guarded reset target.

## MSI reuse

On the MSI, install Windows prerequisites and run the same two phases with its chosen stable workspace root. Then run the verifier and the local smoke test. Its status remains **BOOTSTRAP READY - VALIDATION PENDING** until this is done; do not treat successful Dell validation as MSI validation.
