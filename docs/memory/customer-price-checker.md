# Customer price checker integration

Implemented locally on 2026-09-22 after user approval. Customer kiosks are separate
from employee attendance. Routes: `/api/price-checker`, admin `/kiosk/price-checker/[kioskSlug]`,
admin `/retail-tools/price-checker`.

Tenant-owned Size barcode + WarehouseStock branch scope is authoritative. POS
shops are embedded Tenant settings, not a Shop collection. Shared retail base
pricing and retail pricelists exclude website discounts/markup. Display tax labels
must not double-add tax to the POS selling amount.

Public kiosk sessions use a distinct HMAC-derived signing key, live configuration
version checks and HttpOnly scoped cookies. The proxy lives inside admin. AdminShell skips dashboard providers for customer
kiosks; the service worker uses NetworkOnly for their API. Public responses
are explicitly allowlisted. Scan logging requires MongoDB replica-set transactions
and a unique tenant/kiosk/requestId index; retries do not increase unknown counts.

Verification: earlier full backend 2,881 passing; isolated database integration 6;
final focused backend 22; frontend 39. Existing application type errors and browser/
physical scanner checks remain. Final full-suite rerun was blocked by approval
service usage limit. No deployment or production mutation.

User corrected app ownership: all kiosk UI/proxy now live in admin; platform
kiosk changes removed. Attendance `/kiosk/[token]` stays separate. Generated
links use the current admin origin.

Full file map, actual verification timing, prerequisites and remaining checks:
`docs/superpowers/specs/RESUME-customer-price-checker.md`.

Relocation verified: 42 frontend tests passed; admin typecheck remains at 376
existing errors, none in kiosk files or AdminShell. Platform diff is empty.
Customer route is `/kiosk/price-checker/[kioskSlug]` inside admin, without dashboard
chrome. Browser/physical scanner validation remains before rollout.

Refinement: management cards/search/status filters now show store/location/pricing
labels. Abortable loads, write lock and report race guards added. Scan retries
keep their original idempotency key, time out, and stop after one transient retry.
Offline state persists until actual recovery; Retry reopens the session.
49 tests passed; 376 existing type errors, no price-checker errors. Browser runtime
failed to start, so visual QA remains outstanding. Details in RESUME.

Retail Tools now has `/retail-tools` hub plus guided setup with illustrative live
appearance preview, explicit URL suggestions and assignment validation. Stale
select values remain visible instead of silently changing. Reports use explicit
Lagos date presets and distinguish selected-period from calendar totals.
53 tests passed; 376 existing type errors, no new module errors. No visual QA claim.
