---
name: Wyn City automatic delivery totals
description: Debounced server quotes after address selection, with stale-response cancellation.
type: project
---

2026-10-08: use-automatic-quote in standalone storefront auto-refreshes total after
complete delivery fields change/selection (450ms); requests remain server-authoritative.
Shared delivery-payload used by manual/automatic requests. Waits for geocode/alcohol
confirmation; aborts old requests on edits. Fields editable; payment disabled while
quoting. No auto payment/order. Manual retry on failure; skip duplicate confirmed
quotes. No backend changes. Final evidence in
docs/superpowers/specs/RESUME-wyn-city-auto-delivery-total.md.

Verified70 unit tests,17 checkout/delivery browser cases, types and production build. No backend changes or real payments.

## Effect dependency console error — 2026-10-08
Reported changed-length useEffect array came from hot reload retaining the old
array when quote was added during development. Current source has a fixed literal
dependency array. Added Next-supported // @refresh reset in use-automatic-quote
to remount during future edits. Production behavior unchanged. Browser automation
connection to user's tab unavailable; one manual reload may clear historical
console entry. Verified fresh live browser and focused automation results below.

Refresh verification:2 automatic-total browser cases passed. Fresh live checkout load/reload reported0 effect-dependency console errors.
