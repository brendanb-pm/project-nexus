# Domain model

The canonical V1 model represents uniformed/static-site security operations. UUID primary keys are stable identifiers; relationships carry business ownership rather than duplicating derived facts.

```mermaid
erDiagram
  ORGANIZATION ||--o{ BRANCH : owns
  ORGANIZATION ||--o{ USER : authenticates
  ORGANIZATION ||--o{ EMPLOYEE : employs
  BRANCH ||--o{ CLIENT : serves
  CLIENT ||--o{ CLIENT_CONTACT : has
  CLIENT ||--o{ CONTRACT : governs
  CLIENT ||--o{ SITE : operates
  SITE ||--o{ POST : contains
  POST ||--o{ SHIFT : schedules
  EMPLOYEE ||--o{ EMPLOYEE_ROLE : receives
  EMPLOYEE ||--o{ CREDENTIAL : holds
  EMPLOYEE ||--o{ CERTIFICATION : holds
  EMPLOYEE ||--o{ AVAILABILITY : declares
  SHIFT ||--o{ SHIFT_ASSIGNMENT : staffs
  EMPLOYEE ||--o{ SHIFT_ASSIGNMENT : works
  SHIFT_ASSIGNMENT ||--o{ CLOCK_EVENT : records
  SHIFT_ASSIGNMENT ||--o{ TIME_RECORD : produces
  SHIFT_ASSIGNMENT ||--o{ ACTIVITY_ENTRY : records
  ACTIVITY_ENTRY ||--o| INCIDENT_REPORT : escalates
  SHIFT_ASSIGNMENT ||--o{ DAILY_ACTIVITY_REPORT : summarizes
  SHIFT_ASSIGNMENT ||--o{ INCIDENT_REPORT : reports
  SHIFT_ASSIGNMENT ||--o{ HANDOFF : transfers
  INCIDENT_REPORT ||--o{ INCIDENT_PARTICIPANT : includes
  INCIDENT_REPORT ||--o{ INCIDENT_ATTACHMENT : attaches
  ORGANIZATION ||--o{ ASSET : owns
  ASSET ||--o{ ASSET_ASSIGNMENT : tracks
  ASSET ||--o{ ASSET_CHECKOUT_EVENT : logs
  CLIENT ||--o{ BILLING_RATE : prices
  CLIENT ||--o{ BILLING_PERIOD : groups
  BILLING_PERIOD ||--o{ BILLABLE_TIME_RECORD : contains
  TIME_RECORD ||--o| BILLABLE_TIME_RECORD : supports
  ORGANIZATION ||--o{ AUDIT_EVENT : records
  AUDIT_EVENT ||--o{ OPERATIONAL_RECORD_REVISION : proves
```

Operational records (`ActivityEntry`, `DailyActivityReport`, `IncidentReport`, `Handoff`, and `TimeRecord`) share explicit lifecycle concepts without sharing one overloaded table. `OperationalRecordRevision` stores immutable snapshots for material post-submission changes. `BillableTimeRecord` is approved operational time at an applicable rate; it is not an accounting ledger.

An incident may reference one originating activity entry but does not replace it. New incident reports retain their server-derived assignment/site/post context, authoritative reporting user, submission key, and append-only audit attribution. Later acknowledgement and amendment work extends this history without overwriting the original report.

A handoff is submitted only for the authenticated employee's active assignment. Its unresolved issues, equipment/key status, and follow-up items are retained as a submitted operational record; retries reuse the assignment-scoped submission key rather than creating duplicate handoffs. The next-shift context remains bounded to the same authorized operational hierarchy.

Service types are extensible V1 static/uniformed categories. They contain no vehicle-patrol or Executive Protection behavior.
