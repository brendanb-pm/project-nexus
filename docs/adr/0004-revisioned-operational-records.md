# ADR 0004: Revisioned submitted records

**Status:** Accepted

## Context

Submitted reports and operational records must be correctable without destroying evidence.

## Decision

Keep current domain records queryable while appending immutable snapshots for submission, acknowledgement/approval, and reasoned amendments. Link material revisions to append-only audit events.

## Consequences

History can reconstruct who changed what, when, and why. Mutating services must transact the current-state update, revision, and audit event together.
