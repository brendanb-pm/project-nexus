# Audit and revision model

`AuditEvent` is append-only evidence for security and material business mutations. It records actor, organization, action, target type/ID, timestamp, request/session correlation, before/after state where appropriate, reason, and metadata.

The event vocabulary must cover login/security events, clock edits, incident edits and acknowledgement, report submission, schedule changes, role changes, client-visibility changes, billing-time approval, and asset checkout/check-in. Application services write the business change and its audit event in one database transaction.

Draft edits create normal working revisions. Submission creates an immutable snapshot. A post-submission correction requires an actor and reason and appends an `AMENDED` revision linked to its audit event; it never erases the submitted snapshot. Acknowledgement and approval are separate state transitions with their own actor and timestamp.

The generic revision table is limited to immutable evidence. Current domain tables remain queryable read models and may point to the latest state; history remains authoritative for reconstruction.
