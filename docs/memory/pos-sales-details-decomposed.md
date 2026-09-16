---
name: pos-sales-details-decomposed
description: The 3,651-line POS sales-details monolith lives as a 22-file module; auth/hooks/exports split; 4 calculation bugs fixed (gross, voided summary, UTC dates, memoized order count).
type: architecture
---

The POS Sales Details screen was decomposed from
`client/apps/admin/src/app/shared/point-of-sale/pos-sales-details.tsx`
(3,651 lines) into `…/point-of-sale/sales-details/` (22 files, ≤293 lines each).
`pos-sales-details.tsx` remains as a one-line re-export, so the page import is
unchanged.

Four core-logic bugs fixed in `use-sales-data.ts` / `lib/`:

1. `gross = subtotal + discount` (server-authoritative) instead of
   `priceAtPurchase × qty` — `lib/flatten-orders.ts`.
2. Summary uses `activeRows` only; voided revenue no longer inflates the strip
   when status = "all".
3. Date filtering uses local-time `toTsUtc()` (Nigeria UTC+1), not ISO-UTC.
4. "Distinct orders" footer is a memoized `distinctOrderCount`.

Verification: `tsc --noEmit` clean for `sales-details/**`. PR/commit pending.
Full detail: `docs/superpowers/specs/RESUME-sales-details-decomposition.md`.
Relevant spec: `docs/superpowers/specs/2026-09-15-pos-sales-details-decompose-and-fix-design.md`.