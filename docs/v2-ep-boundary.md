# V2 Executive Protection boundary

Executive Protection (EP) is planned as a separately designed V2 module. No EP, vehicle patrol, travel routing, or mission-management implementation belongs on `main` without explicit authorization.

Future design must define its own domain model, permissions, data-retention rules, operational workflows, and integration contracts before implementation. Shared primitives may be reused only when their security and workflow semantics truly match.
