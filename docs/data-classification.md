# Data classification

Operational records carry one of five visibility classifications:

- `INTERNAL`: ordinary provider operational use; never automatically client-visible.
- `SUPERVISOR`: supervisor and operations handling.
- `CLIENT_VISIBLE`: explicitly approved for an authorized client/site user.
- `EXECUTIVE`: leadership-level provider information.
- `RESTRICTED`: exceptional least-privilege handling.

Classification is evaluated together with capability and tenant scope. It is not a replacement for either. Changing classification is a security-relevant mutation and must emit an audit event. V1 stores no HIPAA/medical or Executive Protection protected-person data.
