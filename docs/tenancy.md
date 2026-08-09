# Tenancy

`Organization` is the provider tenant boundary. All directly owned provider data carries `organizationId`; nested operational records resolve organization ownership through their normalized parent chain. Cross-organization access is always denied before narrower scope checks.

Branches partition operations responsibilities. Clients and sites are authorization scopes, not independent authentication mechanisms. Client users receive explicit client and site grants. Employees receive branch/site responsibility and self scope through server-loaded role assignments.

Repository/service entry points must accept an authenticated authorization context, not a caller-selected tenant. Queries should include the trusted organization boundary and applicable scope predicates. Transactions must re-check ownership when creating relationships so IDs from different organizations cannot be joined accidentally.

Database row-level security is not enabled in Sprint 0B. Central server authorization is the initial enforcement layer; RLS remains a possible defense-in-depth addition after deployment topology and connection identity are decided.
