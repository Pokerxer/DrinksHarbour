---
name: Wyn City tenant customer accounts
description: Tenant-bound REST login, recovery and encrypted storefront sessions
type: project
---

2026-10-08: user corrected shared authentication; all customer login details must
belong only to the store where the customer registers. Approved and implemented.
Wyn City calls /api/integrations/v1/customers using private integration key;
server derives tenant, never visitor tenant/role. Same email can have independent
passwords in separate stores. Platform/staff identities stay platform-scoped.

User loginScope derived from role+tenant; unique email+scope. Checked migration
applied to541 existing platform accounts, zero tenant customers. No identities
reassigned or passwords changed. Existing platform users register separately here.
Separate native customer JWT domain/audience/type, precise password version,
active session checks, atomic refresh rotation and logout revoking both tokens.
Persisted scoped verification/reset/MFA challenges, trusted tenant recovery origin,
password reset revokes all own sessions and pending MFA. No shared auth fallback.

Wyn cookie encrypted with SESSION_SECRET plus current private store key; includes
tenantId and rejects legacy shared cookies. Key rotation requires customer login.
MFA pending survives GETsession; refresh token-only response fetches/me afterward.
Only public customer fields reach browser; guest checkout and edited customer
fields preserved. Matching email never grants guest order history.

Recovery backend env TENANT_CUSTOMER_ORIGINS={"slug":["https://custom-domain"]}.
Local3002 supported outside production; defaults to tenant DrinksHarbour subdomain.
API contract docs/api/tenant-customer-accounts.md; settings reference includes section.
Current handoff/tests: docs/superpowers/specs/RESUME-tenant-customer-auth-isolation.md.

Final checks: 3,454 backend passed (5 optional skipped); 8 real isolated database/HTTP/migration checks; 63 Wyn units, typecheck and build; 48 full browser checks plus all6 customer journeys on final rerun. Actual local invalid login401 verified.
