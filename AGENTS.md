<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Canonical Codex efficiency contract

Load and enforce the canonical standards in `brendanb-pm/Codex-Standards`,
including `Codex-Standards.md` and `Codex-Efficiency-Standards.md`. Apply the
canonical Dynamic Execution Policy.

For substantive story work, emit exactly one compact completion evidence line:

```text
EFF {"story":"ID","files":N,"unrelated":N,"verify":"PASS|FAIL","compliance":"PASS|FAIL","commit":"SHA|null","push":"PASS|FAIL|NA","model":null|"X","priority":null|"X"}
```

Do not add telemetry narrative. Never infer model, priority, tokens, cost, or
elapsed time; leave `model` and `priority` as `null` unless the runtime explicitly
exposes the values actually used. This contract changes no application or runtime
behavior and does not weaken the generated Next.js instructions above.
