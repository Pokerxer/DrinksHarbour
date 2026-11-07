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

2026-10-13: approved management-page refinement implemented. Layout uses available
container width; preserve explicit `width: 100%` on the contained admin flex child.
Dashboard actions now use server-confirmed records, cancel stale refreshes and
separate load/action errors. Token-keyed content plus unmount guards prevent old
account responses from leaking into the new view. Local README records these rules.
38 focused tests pass; full backend 3,732 pass / 5 skip; admin type check has 359
errors outside this module. Browser checked empty fleets at 320/390/768/1440 widths
without horizontal overflow. Final full admin rerun with two workers: 2,725 tests
passed / 315 files; earlier default-worker timeouts all passed without changing
test thresholds. RESUME records verification details. No deployment or live writes.

Analytics refinement (2026-10-13): applied report scope is separate from drafts;
page/refresh/retry use applied filters. Token+kiosk-link keys reset account context
and old requests abort. Kiosk-list failures are visible/retryable independently.
Responsive summary and chart, mobile semantic row cards, safe current prices and
missing-stock labels, distinct later-page/period empty states. Empty reports omit
blank tables/chart/paging. Keep backend shared pagination semantics; do not invent
list totals. 49 focused tests; full admin 2,736 pass; backend 3,732 pass/5 skip;
359 unrelated type errors, none here. Browser reviewed live empty and illustrative
populated layouts at phone/tablet/desktop widths; temporary fixtures removed.


## Kiosk functionality audit and fixes — 2026-11-02

User explicitly requested agent delegation. Three agents owned customer scanning,
backend pricing/isolation, and customer interface separately; primary owned proxy
integration and combined review. Bounded plan:
`docs/superpowers/plans/2026-11-02-price-checker-kiosk-functionality.md`.

Confirmed and repaired:
- Scanner input no longer interrupts session initialization or submits after a
  closed/disabled kiosk. Synchronous sessionReady ref gates scans while preserving
  a stable scan callback. Do not recreate the keyboard scanner when a result or
  screen changes: that loses a barcode prefix arriving during a previous lookup.
- Barcode frames over 128 characters are discarded in full until frame termination
  or explicit/inactivity reset; never interpret the trailing suffix as another
  product. Leading zeros remain unchanged. Tests cover stale results, retry and
  auto-reset deadlines as well as keyboard scanning across result transitions.
- Pricelist fixed/formula setters can supply a valid missing base retail price,
  matching POS. Validate the resolved pre-discount price, then apply discounts.
  Unresolved prices remain unavailable; valid 100% discounts still produce zero.
  Existing live enabled/version checks and tenant/shop/branch/pricelist binding
  protections were reviewed and retained.
- Manual entry restores focus on Close, Escape and submission; exposes expanded
  state and connects announced validation to its input. Editing clears errors.
  Result/loading/result transitions still require fresh alcoholic-item confirmation.
  Age confirmation and the normal result timeout remain unchanged.
- Proxy scan JSON parse errors remain400; malformed upstream session/scan JSON is
  service-unavailable503 so existing transient retry can recover. No cookie is
  issued for invalid upstream data. Customer/admin credentials remain unforwarded.

Changed implementation: components/price-checker/{scanner.ts,use-kiosk.ts,
kiosk.tsx,kiosk-display.css}, app/api/price-checker/[...path]/route.ts and
server/services/priceChecker/pricing.js. New frontend tests: scanner-overflow,
use-kiosk,kiosk-interface and shared/price-checker/proxy-failures. Backend regression
added to priceChecker.core.test.js. Preserve unrelated dirty management/header,
warehouse, product and other files.

Verification: baseline49 frontend tests. Final64 frontend tests in16 files passed
(shared/price-checker + components/price-checker); final28 backend core/lookup/routes/
analytics tests passed. Each defect reproduced before repair, including the
integration review's mid-scan result-transition case. Admin TypeScript passed with
build info outside the source tree; work/kiosk/typecheck.log is empty. Scoped
whitespace checks passed. Review completed directly by primary; no new dependencies.

Browser: existing local admin served the isolated customer kiosk without dashboard
chrome. Unconfigured kiosk displayed unavailable at500px viewport, no horizontal
overflow. Earlier connection-unavailable screen was also observed. Attempted
browser-only synthetic fetch fixtures did not exercise ready/product screens
because the unconfigured kiosk was closed; restored fetch and discarded test tabs.
A transient hook-order error during live edits disappeared on cold navigation.
Do not claim active configured-kiosk, physical scanner, database integration or
production validation. Automated tests cover active/manual/result behavior.
No kiosk configurations, scan records or business data were created/changed;
no commit, push, deployment or backend process restart was performed.


Kiosk name auto-fill (2026-11-02): new kiosk name changes now generate internal ID
(uppercase underscores) and URL slug (lowercase hyphens), using suggestedSlug's
accent/punctuation normalization and120-character cap. IdentityFields receives an
explicit create-only autoGenerate prop from editor.tsx. Manual edits stop automatic
updates for that field independently. Suggest URL explicitly resets/regenerates
slug and resumes name-following in create mode. Existing kiosk renames never change
saved IDs/URLs automatically. Store, pricing, currency and messages retain defaults.
New editor-auto-identity.test.tsx covers name changes/clearing/accents, independent
customizations, saved rename preservation, and actual create payload. Tests first
failed against missing generation, then all4 passed after implementation.

Final auto-fill verification:68 price-checker frontend tests passed in17 files;
admin TypeScript passed, log work/kiosk-autofill/typecheck.log empty. Scoped diff
checks passed. No backend changes, configuration writes, commit or deployment.
