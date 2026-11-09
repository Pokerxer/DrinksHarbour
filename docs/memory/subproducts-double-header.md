# Sub-products pages render one header, not two (2026-11-08)

## Complaint

Every `/sub-products/*` page (screenshot: the edit page) showed TWO stacked
navigation headers — the Marketplace ecommerce nav ("Marketplace · Dashboard ·
Products · Tenants · Orders · Engagement · Configuration") directly below the
Sub-Products POS-style module nav ("Sub-Products · My Sub-Products · Add
Sub-Product").

## Root cause

The `sub-products/layout.tsx` renders `SubProductsNavGate` (ModuleNavHeader —
the module's intended, always-on chrome; its test asserts exactly that), so
the module shell is already above every page. Each of the four page files
ALSO rendered `EcommercePageHeader` (the Marketplace ecommerce nav) in their
non-POS branch — leftovers from before the POS-style module shell landed. The
`?from=pos` branch avoided the duplicate (it hides the module header and
renders POSNavHeader), but the normal branch stacked two headers.

## Fix

Removed `EcommercePageHeader` (import + JSX) from the normal branch of all
four pages:

- `(hydrogen)/sub-products/page.tsx` (list) — POS branch kept untouched
  (single header there was already correct: POSNavHeader instead.)
- `(hydrogen)/sub-products/create/page.tsx`
- `(hydrogen)/sub-products/[slug]/page.tsx` (details)
- `(hydrogen)/sub-products/[slug]/edit/page.tsx` — dropped `@ts-nocheck`
  (no longer needed) and each file now carries a comment warning future
  editors not to stack another header on the layout's chrome.

The in-page action toolbar (product title / Active badge / Save / AI) is a
page toolbar, not a second nav — it stays.

## Verification

- `npx vitest run src/app/shared/ecommerce "src/app/(hydrogen)/sub-products"` —
  84 files / 433 tests green (incl. the nav-gate tests asserting
  ModuleNavHeader chrome renders and hides under ?from=pos).
- `tsc --noEmit` clean for the touched pages (edit page passes without
  `@ts-nocheck`).
- Manual: `/sub-products`, `/sub-products/create`, a listing's detail and its
  `/edit` show exactly one nav header (Sub-Products module nav); `?from=pos`
  deep links still swap it for the POS chrome, never both.
