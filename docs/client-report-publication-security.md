# Client report publication security boundary (NX-8.12A)

This is a technical repair and re-review record for PR #55, not product approval,
human security acceptance, merge authority, or production acceptance.

## Confirmation and source review

A staged draft now stores the exact client-safe review snapshot and a SHA-256
fingerprint of that snapshot and the selected canonical source rows. The review
panel shows the staged client/site labels and source-derived timestamp/category
or incident number/classification/severity before explicit confirmation. Source
summaries and source narratives remain distinct; raw narrative, participants and
evidence are not added to the review DTO or published projection.

Object keys are sorted by code-unit order recursively before JSON serialization;
array order is preserved. The fingerprint covers actual source row content,
status and visibility, rather than relying on every writer to update a timestamp.
Raw source-row material is transient inside the server repository; only hashes
and the client-safe snapshot are persisted by this repair.

Publication locks the draft, then scope label rows and selected Activity/Incident
rows in deterministic ID order with shared source locks. It recomputes and
compares the staged fingerprint before inserting the immutable publication and
audit event in one transaction. A concurrent writer either commits before the
locked read and causes rejection/re-review, or waits until publication commits.
Only PostgreSQL-aborted serialization/deadlock transactions (40001/40P01) receive
up to two retries. Unknown mutation outcomes and ordinary errors are not retried.

The publication stores the confirmed draft revision, source fingerprint and
canonical snapshot hash. An identical confirmation-key/revision/version retry
returns the original publication; the same key with a different revision or
expected version rejects. Audit metadata includes that confirmation identity.
Existing authorization is still enforced before replay or content lookup.

## Compatibility and migration

Additive migration `0023_client_publication_confirmation.sql` adds nullable
review/confirmation columns. Historical publication snapshots are not rewritten.
Legacy drafts without review binding must be saved/restaged and reviewed before
publication. Legacy key replays with unknown confirmation identity fail closed;
historical publication reads remain available under current authorization.

Apply migrations in order using `npm run db:migrate`, then repeat the command to
verify no-op replay. Before use, a rollback may remove the new nullable columns
after reverting the application repair; after publications use the new identity,
preserve that evidence and prefer a forward repair. No automatic down migration
or historical-data rewrite is provided.

## Finding dispositions

| Finding                    | Disposition                              | Evidence / remaining boundary                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CP-01                      | CONFIRMED DEFECT, repaired               | Same-key/different-revision and source-amendment assertions failed on the old code. Equality retry, mismatch rejection and immutable original checks now pass.                                                                                                                                                                                                         |
| CP-02                      | CONFIRMED DEFECT, repaired               | Source changes without timestamp maintenance require re-review. Native PostgreSQL lock barriers test both publication-first and writer-first visibility races. Incident narrative amendment also invalidates staged review.                                                                                                                                            |
| Current read authorization | COVERAGE GAP, tested                     | Fresh database-backed membership resolution denies revoked membership, removed client grants and partial multi-site grants after publication. No permission widening or new auth system.                                                                                                                                                                               |
| CP-03                      | POLICY QUESTION                          | Inactive-site historical reporting requirements are not established; no blanket inactive-site denial introduced.                                                                                                                                                                                                                                                       |
| CP-04                      | POLICY QUESTION / COVERAGE GAP           | Explicit-offset UI inputs currently represent rolling windows. Calendar/timezone/DST and future-period policy remain undecided; no universal multi-site timezone invented.                                                                                                                                                                                             |
| CP-05                      | COVERAGE GAP / POLICY QUESTION           | Existing 25-item publication/draft lists remain bounded; a 27-version regression confirms direct historical reads beyond the list under current authorization. Pagination and shared-draft discard/retention are not claimed fixed. Personal draft retention is not copied into shared publication policy.                                                             |
| CP-06                      | DEFENSE-IN-DEPTH                         | Rolled-back assertion probes confirm DB acceptance of ownership inconsistency and an actual cross-draft/non-adjacent supersession link. T12 in the original SQL only tests a same-draft version skip. Application writes derive these fields from authorized drafts; no reachable application exploit established. No speculative disruptive constraint/trigger added. |
| CP-07                      | DEFENSE-IN-DEPTH / DEPLOYMENT DEPENDENCY | Existing immutable UPDATE/DELETE behavior remains tested. Owner TRUNCATE is not treated as an app exploit. Actual production role ownership/grants need deployment evidence; no owner TRUNCATE was executed here and no TRUNCATE trigger added.                                                                                                                        |
| CP-08                      | DEFENSE-IN-DEPTH / POLICY QUESTION       | Existing bounded snapshot source IDs/classification/severity remain subject to field approval. Client serialization/sentinel and browser output checks cover current surfaces; no future export is assumed.                                                                                                                                                            |
| CP-09                      | DEFENSE-IN-DEPTH / COVERAGE GAP          | A role-matrix regression verifies every current VIEW_CLIENT_REPORTS role also has VIEW_CLIENT_INCIDENTS. Hypothetical future role changes are not current exploits.                                                                                                                                                                                                    |

## Review provenance and remaining gates

The original Claude preliminary report, findings JSON and SQL evidence were
recovered from the user-supplied `NX-8.12A-Review-Input-Recovery.zip`. All four
original SHA256SUMS entries were verified, with `evidence/` paths preserved:

- `NX-8.12-Claude-Security-Review-PRELIMINARY.md`: `2485432e96b30c7195b8806b1be90226bbf9b590f5c4b3efdb19bd4dcf7a8bc7`
- `NX-8.12-Claude-findings.json`: `6a51032c8f6a90098241e86d6024116b220b8eb4d43e333aff0b2205089a70e8`
- `evidence/db_tests.out`: `c7a2cb0010215ad6a3732c37039cff7104847211ccde5a2658f0c71e3b73b66b`
- `evidence/db_tests.sql`: `fef598eb4816a7e173d2f972aba8e11f579313aa7238cacd0280a6d5b218b1e3`

README's Grok note is secondary evidence, not a sealed original or executed test
record. Full two-original-review reconciliation remains incomplete until the
full Grok report is recovered. Both reviewers must examine one immutable final
candidate and the changed boundaries. The independent human security gate,
product decisions, release approval and production acceptance remain open.

Policy questions retained for the product owner: shared draft ownership and
retention; rolling/calendar period and timezone semantics; retroactive source
restriction; approved client fields; publication-only portal scope; unchanged
republishing; multi-site composition; and denial auditing. The saved definition
and inspected durable policies do not resolve these decisions. Existing behavior
is preserved while the confirmed integrity defects are repaired.

## Verification surfaces

- `tests/client-publication.test.ts`: capability/validation boundaries.
- `tests/client-publication-postgres.integration.test.ts`: tenant/site denial,
  rollback, concurrency, replay, supersession and immutability.
- `tests/client-publication-security.postgres.integration.test.ts`: confirmed
  mismatched replay, source amendments, deterministic source locks, legacy data,
  audit identity, current grants/membership and rolled-back DB constraint probes.
- `tests/e2e/nx8-12*.spec.ts`: supported authenticated local persona path,
  rendered review, client-safe output, current/historical reports, actual short
  and long browser PDFs, cache response and cross-user denial, mobile reflow.
- CI explicitly runs publication PostgreSQL regressions in its guarded,
  disposable test database. Tests reject unmarked/non-loopback database targets.

Local repair execution uses a separate task-labelled PostgreSQL container,
generated test credentials, ephemeral loopback port, tmpfs and a marked test DB.
No existing Nexus database is reset, migrated, seeded or repurposed. The original
Claude SQL is retained unchanged as evidence and is not a turnkey test harness.
Final observed results and the immutable candidate SHA belong in the re-review
packet and control-plane receipt; old green CI is not final acceptance.
