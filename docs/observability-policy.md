# Production observability policy (NX-7.9)

Approved operational defaults are owned by Nexus Product Owner / Greyfir Systems.
These are operational limits, not legal or statutory retention advice.
Production activation requires separately authorized deployment acceptance.

## Envelope and correlation

Application-owned diagnostics use one JSON record per measured completion or
identified CLI failure, at most 2 KiB. The approved fields are `event`,
`operation`, `correlationToken`, `requestDurationMs`, `databaseDurationMs`,
`queryCount`, `slowestQueryDurationMs`, `rowsReturned`, `payloadBytes`, `outcome`,
and `errorCode`. No arbitrary metadata, nested objects, timestamp or extra fields
are emitted. Durations are finite nonnegative numbers; counts and bytes are
nonnegative safe integers. Invalid aggregates are omitted. Events are
`nexus.performance` and `nexus.diagnostic.error`; outcomes are Promise
`success`/`error`, not a classification of every business response.

Operation labels come from `DIAGNOSTIC_OPERATIONS`: a finite registry of actual
instrumented boundaries and the two CLI failure categories, with labels at most
64 ASCII characters. Unknown, oversized, dynamic, CR/LF, resource-ID or
query-string labels become `UNKNOWN_OPERATION`, without truncating or echoing
their source. Getters, toJSON and arbitrary exception contents are never used by
the envelope projection. Known application error types map to the fixed codes
AUTHENTICATION_REQUIRED, PERMISSION_DENIED, NOT_FOUND, VALIDATION_ERROR,
STALE_UPDATE, DUPLICATE_RESOURCE and INVARIANT_VIOLATION. Other errors, including
unknown objects with a familiar code, map to UNKNOWN_ERROR.

An independent server-generated random UUID (36 characters) belongs to each
outer measurement scope. Nested diagnostics share it; concurrent outer scopes
do not. It is ephemeral process context, with no identity mapping, persistence,
audit join, HTTP header or response field. It permits within-scope diagnostic
correlation only. Harness observers retain their aggregate/statistics contract
and failures; sink failures cannot retry business work or replace its result.

## Identifier matrix

| Class                                                             | Diagnostic handling                               |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| Tenant, organization, branch, site, client, employee, user, actor | Prohibited, including stable hashes               |
| Assignment, report, incident, other resource IDs                  | Prohibited, including in operation labels         |
| Incoming request ID, trace headers, session ID, auth subject      | Prohibited; never determine the independent UUID  |
| Names, email, phone, IP address                                   | Prohibited                                        |
| Access, refresh and ID tokens; cookies; authorization headers     | Prohibited                                        |
| Passwords, secrets, keys, database URLs                           | Prohibited                                        |
| Request/response bodies, report/record content                    | Prohibited; only aggregate payload byte estimates |
| SQL text, parameters, driver detail/hint                          | Prohibited                                        |
| Error message, stack, cause, arbitrary code or raw object         | Prohibited; fixed typed category only             |
| Independent diagnostic UUID                                       | Allowed within scope; 14-day correlated retention |
| Finite operation and numeric aggregates                           | Allowed under the bounded envelope                |

## Retention and operator verification

Correlated diagnostics have a 14-day operational retention default. Identity-free
aggregates and temporary synthetic test artifacts have a 30-day operational
retention default. Protected business/security audit records, revisions, report
content and reporting-draft lifecycle rules are separate and unchanged; these
diagnostic defaults neither delete nor gate audit evidence.

The owner must inventory and apply the schedule to all copies: collectors,
platform logs, exports, replicas, archives, backups and temporary synthetic
artifacts. Where a platform cannot expire a copy on this schedule, record the
limitation, access restrictions and owner decision before activation. Do not
claim compliant deletion merely because a primary index expires a record.
An incident/investigation hold needs documented purpose, authorized owner,
restricted access, review date and explicit release review; it is not an
indefinite retention exception. Never delete audit evidence under this policy.

The application does not enforce or prove collector expiry or deletion. External
collector configuration requires operator/deployment evidence before production
activation: inventory all destinations, verify access controls and both expiry
schedules, inject synthetic records, observe their removal after the configured
period in every applicable copy, and retain sanitized configuration and expiry
verification with revision, timestamps and owner approval. Missing collector
evidence means diagnostics stay off. Do not fabricate an application TTL.

## Production gate and external limitations

`NEXUS_PRODUCTION_DIAGNOSTICS=false` is the default. In production, only the exact
value `true` enables safe-envelope output; absent, false or malformed values
remain off even if `NEXUS_PERFORMANCE_TELEMETRY=true`. The concrete runtime flag
is the evaluator binding for the proposed production observability gate.
Non-production legacy opt-in and harness observer mode remain available.
Diagnostic flags never control protected audit writes or transactional audit
failure handling. The organization error UI emits no client diagnostic transport.

Framework/provider, hosting, reverse-proxy, database-server and unrelated
development/seed logs are outside this application's projection. Operators must
separately validate those streams; this policy is not evidence that their
content, configuration or expiry is safe. No vendor/exporter or production
activation is supplied here. Suspected leakage requires stopping the affected
diagnostic stream and owner-led containment of collected copies. Disabling the
flag or reverting code cannot erase existing logs. Keep the legacy flag off in
production during rollback; preserve audit writes and evidence.
