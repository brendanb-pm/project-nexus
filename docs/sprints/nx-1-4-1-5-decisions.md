# NX-1.4 and NX-1.5 decisions

## Employee and User profiles

Employee records are operational personnel records, not authentication accounts. An employee may have no Nexus User. A link to an existing, organization-scoped User is explicit, one-to-one, and audited; it never creates an OIDC identity or membership. The User and active membership remain the authority for application access. Employee profiles are intentionally limited to employee number, display name, work phone, employment status, and primary branch. Payroll, medical, and broader HR information are not stored.

An inactive User is denied by the existing membership resolver. An inactive Employee remains historical but is ineligible for future operational work; it does not disable the linked User or alter prior records. Employee profile mutation and User linking require `MANAGE_EMPLOYEES`. Compliance readers receive only bounded operational identifiers and must not infer that read access permits sensitive-profile administration.

## Credentials and certifications

Credentials represent licenses, permits, clearances, and other authorization artifacts. Certifications represent training, qualification, or competency records. Both have independent tables and a shared, bounded administration boundary.

Records use `active`, `expired`, `suspended`, `revoked`, and `pending_verification` states. Verification writes the authoritative internal actor and timestamp. Renewal creates a successor linked through `predecessorId`; it never replaces the prior issuance. Date validation and optimistic concurrency protect mutable metadata while audit events retain material history.

The reusable eligibility evaluator compares normalized Post qualification names with currently valid credential/certification types. The existing armed Post requirement is satisfied by a currently valid credential whose type is `armed_authorization`. This is a V1 naming convention, not a scheduling workflow; a future qualification catalog may replace it without changing historical records. Expired records affect only future eligibility and do not rewrite completed assignments.

## Human factors and performance

- **FIXED:** employee and compliance selection uses bounded human-readable names, numbers, branches, and status rather than UUID entry.
- **JUSTIFIED POWER-USER INPUT:** employee number, credential identifier, IANA timezone, and non-secret document reference are known operational values.
- **DEFERRED WITH REASON:** high-volume server-side employee search and live latency instrumentation need representative deployment data; list/detail projections are bounded at 25/100 and do not use N+1 queries.
