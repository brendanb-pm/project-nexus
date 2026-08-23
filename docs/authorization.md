# Authorization

Authorization is a centralized, deny-by-default decision over three inputs: an authenticated principal loaded by the server, a capability, and the authoritative scope of the target record.

The initial roles are `GUARD`, `SUPERVISOR`, `OPERATIONS_MANAGER`, `CLIENT_USER`, `LEADERSHIP`, and `ADMIN`. Roles resolve to capabilities in `src/auth/authorization.ts`; route code must not compare role strings independently.

Every decision evaluates:

1. Capability membership.
2. Exact provider organization match.
3. Branch, client, and site membership when those dimensions apply.
4. Employee ownership for self-service capabilities.
5. Record visibility classification.

An identifier supplied by a browser is only a lookup hint. Server code must load the target and actor scope from trusted persistence, then call `authorize`. UI navigation may improve usability but never grants access.

The initial visibility matrix is deliberately least-privileged. Client users receive only `CLIENT_VISIBLE`; guards receive `INTERNAL` and `CLIENT_VISIBLE` within self/assignment scope; supervisors and operations managers also receive `SUPERVISOR`; leadership and administrators may receive all classifications within their organization scope.
