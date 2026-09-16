---
name: Shop-owned POS sessions
description: Investigation and proposed boundary for individual shop sessions and history
type: project
---

2026-09-14: user requested independent POS sessions/order history per shop.
Investigation confirmed sessions, client carts and realtime terminal rooms group
by retail/wholesale, while history queries are tenant-wide. Session reports query
posSession although Order stores posSessionId. Existing shop-to-stock-location
resolution does not solve these session boundaries.

Implementation is complete. Stable tenant/shop ownership now flows through
sessions, orders, holds, checkout, reports, realtime rooms, carts and offline
replay. A partial unique database index permits parallel shops while rejecting a
same-shop open-session race. Session totals use linked `posSessionId` orders and
ignore held/voided/unpaid records. Existing records with no shop remain in the
legacy view and must be explicitly reconciled before new drawers open.

Verification: 38 focused server tests (37 pass; one unavailable-Mongo skip, plus
the same test passed against isolated MongoDB), and 16 focused admin POS tests
pass. Changed POS files introduce no TypeScript errors. The full server baseline
still has 97 unrelated authorization/endpoint failures (2713 pass, one skip).
No production data, deployment or commit changed.

Follow-up fix: the POS landing page loaded session cards from its cached shop
list before fetching current shops, suppressed API errors, and implicitly
scoped the overview to the last selected shop. `dashboard-data.ts` now awaits
the current shop list before fetching each shop's session. The landing page
prefers the signed-in back-office token and explicitly requests `shopId=all`
for that overview; cashier-only views retain the selected shop. The loading
hook clears stale results, ignores superseded requests, and surfaces failures.
Terminal session queries remain isolated; legacy sales count in the all-shop
overview without assigning their sessions to an arbitrary shop.

Regression verification: nine focused dashboard/API/shop-scope/offline tests
passed. Admin TypeScript finished with existing repository errors and none in
the files changed for this loading fix; git diff --check passed.
Live browser verification was unavailable because the browser tool failed to
start (sandbox kernel error).

Legacy recovery follow-up: user is blocked by an unassigned open drawer. The
Legacy screen's close action used the POS-token-only endpoint even when the
screen was accessed through an owner/admin login. Added a dedicated, tenant-scoped
legacy-close endpoint for owners/admins and authenticated selling cashiers;
requires counted cash and restricts its target to an unassigned session. Both
open-session controls now link to `/pos/sessions?shopId=legacy`, which selects
Legacy and open sessions. No live drawer was closed or assigned to a shop.

Verification: 14 focused server tests and 9 client regression tests pass. Full
server suite: 2722 passed, 97 failed, 1 skipped (same previously recorded failure
count). Whitespace checks pass. Browser verification remains unavailable.
Admin type checking also caught an existing unknown JSON payload in the Sessions
token-expiry helper; added object and numeric-expiry guards. The broader app
still has unrelated type errors.

Wholesale CBL follow-up: dashboard passes a custom shop ID as `terminal`, but
lock-screen login compares that ID with the literal wholesale string and never
sets the tenant shop selection. Fix the entry boundary with a tested shop-entry
helper and save selection under the authenticated tenant. History pages need
explicit back-office all-shop scope (including Legacy), consistent credential
selection, and a shop filter on the separate back-office Orders component.

Completed: `shop-entry.ts` validates exact shop identity against a fresh shop
list before successful login or PIN bypass. Auth saves the shop under the NEW
tenant ID and its actual selling mode. Timeout relocking preserves shop identity;
opening controls show shop names. Unknown/inactive shops fail instead of opening
Retail. Back-office Orders, POS History, and Sessions prefer the back-office JWT,
default to all shops, and allow explicit individual/Legacy scope. The separate
Orders component now shows load errors and ignores obsolete requests. The old
Sessions route preserves the Legacy deep link.

Verification: 14 focused client and 15 focused server tests pass. Admin type
checking has no errors in this follow-up's changed files; unrelated repository
errors remain. No live Wyn City session was modified or reassigned, and browser
verification remains unavailable in this environment.

Session Report and Sales Details follow-up: both pages now use the authenticated
back-office token when available and send an explicit shop scope on every
session/order request. Back-office views default to All shops, while cashiers
remain scoped to their active shop. Sales Details now includes the shared shop
selector (including Legacy); Session Report retains its selector and corrects
its token scope. Focused client and server tests pass. Type checking has no
errors in these changed files; unrelated repository errors remain.
