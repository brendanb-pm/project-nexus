# Project Nexus — Repository Instructions

These rules apply repository-wide unless a more-specific descendant `AGENTS.md` overrides them.

## Canonical standards

Canonical standards are maintained only in:

`https://github.com/brendanb-pm/Codex-Standards`

Use one shared local read-only checkout for all projects.

Resolve the checkout path in this order:

1. `CODEX_STANDARDS_HOME`, when set.
2. Otherwise `$HOME/.codex/Codex-Standards`.

At the first substantive task of a session, refresh that checkout once:

- if missing, clone `https://github.com/brendanb-pm/Codex-Standards`;
- if present and clean, update it with a fast-forward-only pull from `main`;
- do not refresh again for every task in the same session;
- agents must never edit, commit, push, reset, or otherwise mutate the canonical standards repository except for the refresh operation above.

If the checkout is dirty, conflicted, or cannot be safely refreshed, do not reset or discard anything automatically. Report the condition. A previously cached clean checkout may be used only when `Codex-Standards.md` is present; report `STANDARDS SOURCE: CACHED; FRESHNESS: UNVERIFIED`. If no usable checkout exists, stop substantive execution and report `CANONICAL STANDARDS UNAVAILABLE`.

Load only:

- `<standards-home>/Codex-Standards.md`; and
- conditional modules triggered by the task.

Do not copy canonical standards into this repository. Do not load every module by default. Use the core deterministic model/priority policy: select once before execution and do not continue discussing model choice during the run.

## Durable project sources

Before changing architecture, security boundaries, persistence, tenancy, or major scope, inspect only the directly relevant durable documentation. Canonical project references include:

- `docs/architecture.md`
- `docs/domain-model.md`
- `docs/database.md`
- `docs/authentication.md`
- `docs/authorization.md`
- `docs/tenancy.md`
- `docs/audit-model.md`
- `docs/data-classification.md`
- `docs/v1-scope.md`
- `docs/v2-ep-boundary.md`
- applicable `docs/adr/` records and `docs/sprints/` specifications

Do not load all documentation by default. Read only the files required by the task.

## Nexus boundaries

Preserve explicit tenant isolation, authorization enforcement, auditability, and data-classification boundaries. Do not weaken these controls to simplify implementation or testing.

Treat authentication, authorization, tenancy, sensitive-data handling, audit semantics, schema/migrations, and external integrations as high-risk triggers under the canonical standards.

Do not introduce duplicate domain concepts, persistence paths, or authorization mechanisms before checking existing models, services, schema, and durable docs.

V1 and V2/EP boundaries must remain explicit. Do not make V2/EP capability a hidden dependency of V1 unless the applicable specification explicitly changes that boundary.

## Data and migrations

For schema or migration work, load `modules/DATA-MIGRATIONS.md` and inspect `docs/database.md`, `docs/domain-model.md`, and the directly affected Drizzle schema/migrations.

Preserve tenant ownership, stable identifiers, historical/audit records, and documented lifecycle semantics.

## Security and user-facing behavior

For authentication, authorization, tenancy, secrets, or sensitive-data work, load `modules/SECURITY-AUTH.md` and the relevant security docs.

For new or materially changed UI/workflows, load `modules/UI-UX.md`. Add `modules/PERFORMANCE.md` only when latency, scale, loading behavior, or documented performance budgets are materially affected.

## Tests and reporting

Use existing targeted tests first, including Playwright only when the affected workflow requires end-to-end evidence. Expand verification proportionally under the core standard.

Keep completion reports concise and include applicable changed files, tests/results, schema/config changes, loaded modules, blockers/deferred scope, commit/push state, and the core `EFF` line for substantive story work.

## Integration default

Completed feature, story, and sprint work follows the normal automatic
integration path: run its required acceptance gates; when they pass and no
material high-risk or high-impact condition is present, push the branch,
create or update its PR, merge it, verify remote `main`, and report the
integrated main SHA. Do not leave accepted work indefinitely on a feature
branch or draft PR.

Manual review is the exception. Stop before merging only for a destructive or
irreversible schema/data migration; material authentication, authorization,
RBAC, or tenant-boundary change; irreversible production infrastructure or
configuration change; major dependency/framework/runtime upgrade; ambiguous
merge conflict or architecture change; failed/skipped/waived acceptance gate;
security or tenant-isolation regression; material data-loss risk; or an
unresolved product, legal, or compliance decision. Additive migrations and
ordinary tested backend, UI, or multi-file feature work are not review triggers
by themselves.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
