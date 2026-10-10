# Tenant customer accounts

Base: `/api/integrations/v1`. All customer requests require the tenant's private
`Authorization: Bearer <API key>` with `storefront:read`. Call from your website
server. The key resolves the tenant; visitor-supplied tenant/role fields are rejected.

Accounts at different stores are independent, even with the same email. Staff and
platform accounts cannot authenticate through these endpoints. Platform `/api/users`
login, refresh, verification and recovery exclude tenant customers. Existing platform
customers are not assigned to a store by matching email.

| Method | Path | Body / extra header |
| --- | --- | --- |
| POST | /customers/register | firstName, optional lastName, email, password, optional phoneNumber |
| POST | /customers/login | email, password |
| GET | /customers/me | X-Customer-Token: access token |
| POST | /customers/refresh-token | refreshToken |
| POST | /customers/logout | refreshToken |
| POST | /customers/verify-email | email, code (six digits) |
| POST | /customers/resend-verification | email |
| POST | /customers/forgot-password | email, optional returnOrigin |
| POST | /customers/reset-password/:token | newPassword |
| POST | /customers/mfa/verify | pendingMfaToken, code |

Successful signup/login returns `{success:true,data:{user,token,refreshToken}}`.
`user` has `_id`, `tenantId`, customer role, firstName, lastName, email, phone and
isEmailVerified only. Passwords: 8–128 characters, at most 72 UTF-8 bytes, uppercase,
lowercase, number and symbol. A login password is not restricted by new-password
strength requirements. Signup returns 201; other successful operations return 200.

MFA-enabled login instead returns `{mfaRequired:true,pendingMfaToken,tenantId}`.
Complete within five minutes. Email codes expire after ten minutes; reset links
expire after one hour. Challenges are persisted, tenant-scoped and consumed once,
with five failed attempts maximum. Resend waits at least one minute. MFA backup
codes are consumed atomically. Password reset invalidates sessions and pending MFA.

Access tokens expire after 15 minutes. Refresh tokens expire after 30 days and rotate
atomically once. Refresh returns token and refreshToken **without user**: re-fetch
`/customers/me`. Access, refresh and MFA JWTs have a distinct signing domain and
audience, tenant identity and token type. `/me` checks current account status,
password version and active session. Logout revokes access as well as refresh.
Keep tokens encrypted in host-only HttpOnly Secure SameSite=Lax website cookies,
never browser storage, public environment variables or client JSON responses.

## Recovery origins

Default reset link: `https://<tenant-slug>.drinksharbour.com/reset-password?token=...`.
For a custom website configure the **backend**, not the browser:

```dotenv
TENANT_CUSTOMER_ORIGINS={"wyncity":["https://YOUR_WYN_CITY_DOMAIN"]}
```

Use the exact tenant slug. The website server sends its own origin in returnOrigin;
HTTPS origins must exactly match that tenant's allowlist. Paths, credentials and
other tenants' origins are rejected. Local port 3002 is allowed only outside
production. Email origins do not change platform password recovery configuration.
Recovery/resend give a generic response even if no customer exists or mail delivery
fails. Delivery failures are logged without secrets; visitors can retry later.

## Migration and rollout

Run `node -r dotenv/config scripts/migrate-customer-login-scope.js --dry-run` from
server, then `--apply` once the preview is checked. MONGODB_URI must be explicit.
Use a maintenance window for deployment and account-authority mutations. The script
preserves IDs, passwords, role and tenant; it derives loginScope from those fields,
backfills with ownership guards, creates `{email,loginScope}` unique index **before**
dropping the old global email index. Duplicate or malformed identity data stops the
migration. It is safe to repeat; do not revert the global index after stores have
created independent accounts with matching emails. Old shared website sessions
must be discarded. Unscoped existing customers remain platform accounts and must
register independently in a tenant store.

Wyn City uses only `/customers`, its configured private key and store-bound encrypted
cookies. Rotating the key clears customer sessions; customers can sign in again.
Guest checkout remains supported. An email match never grants access to past guest
orders. Generic admin/POS staff account lookups retain the platform namespace, while
customer-cart matching requires the authenticated staff tenant.

## Checks

Backend unit suite plus opt-in `tenantCustomerMongo.integration.test.js` against
only `mongodb://127.0.0.1:<port>/drinks_auth_test_<id>`. Never point this test at
MONGODB_URI; it drops its isolated test database. Fixtures cover independent
passwords for the same email, cross-tenant access/refresh/code/reset/MFA rejection,
refresh concurrency, logout, real API-key HTTP authorization and migration safety.
Frontend unit/type/build/browser checks cover encrypted store-bound cookies and
all customer journeys without sending real emails or creating live accounts.
