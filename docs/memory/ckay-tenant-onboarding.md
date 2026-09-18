---
name: ckay-tenant-onboarding
description: CKay tenant first-run setup on production — tenant admin created, *.drinksharbour.com wildcard Vercel fix documented, and 4 wine-accessory SubProducts created via subproduct.service. Includes service gotchas (Brand model registration, partial writes in non-transactional mode).
type: memory
---

# CKay tenant first-run setup (production `drinksharbour`)

## Admin credentials (created 2026-09-17)

- Email: `admin@ckay.drinksharbour.com`
- Password: `CkayAdmin@2026!`
- User `_id`: `6aac10a1b3ea6d817d1fc7bb` — role `tenant_owner`, `Tenant.admin` linked
- Tenant: slug `ckay`, `_id` `6aabec2b9294f4afed5ce61f`, status `approved`,
  plan `starter`, subscription `active`, revenueModel `markup`, markup `40%`,
  commission `12%`
- Subdomain for the tenant store: `<slug>.drinksharbour.com` → `ckay.drinksharbour.com`

## Vercel 404 DEPLOYMENT_NOT_FOUND (diagnosed, fix is dashboard-only)

- DNS is correct: NS = `vercel-dns.com`; all `*.drinksharbour.com` resolve to
  Vercel POP IPs. Apex domain is attached (307 → www).
- Root cause: **no wildcard `*.drinksharbour.com` domain attached** to the
  platform app's Vercel project. `ckay.drinksharbour.com` returns
  `x-vercel-error: DEPLOYMENT_NOT_FOUND`.
- Fix: platform app Vercel project → Settings → Domains → add `*.drinksharbour.com`.
  No DNS or code changes; `app/platform/src/middleware.ts` already does
  slug → `x-tenant-slug` injection.
- `vercel` CLI not installed/authenticated, so this step must be done in the
  Vercel dashboard.

## Wine accessories created for CKay (4 SubProducts)

All central Products created as `type: accessory`, `subType: stopper`,
`isAlcoholic: false`, `status: pending` (awaiting super-admin approval to appear
on the main marketplace — sellable in CKay's store immediately). SubProducts:
`active + published`, `20/20` stock, `unit` size auto-created, sell-via-revenue-model:

| Product (_id) | SubProduct SKU (_id) | cost ₦ | sell ₦ |
|---|---|---|---|
| Champagne Stopper (`6aac18c6f2af39ec50a0b013`) | `CKA291-CHAME104-HORY1C` (`6aac18cbf2af39ec50a0b023`) | 4,500 | 6,500 |
| Mini Wine Stopper (`6aac18f4f2af39ec50a0b056`) | `CKA291-MINIA5C6-YBAQ4M` (`6aac18f7f2af39ec50a0b069`) | 2,500 | 3,800 |
| Wine Vacuum Stopper Black (`6aac18faf2af39ec50a0b07e`) | `CKA291-WINEF211-5QNQZ0` (`6aac18fcf2af39ec50a0b086`) | 7,500 | 10,500 |
| Wine Vacuum Stopper Silver (`6aac18fef2af39ec50a0b097`) | `CKA291-WINE55E3-FN2SEJ` (`6aac1901f2af39ec50a0b09f`) | 7,900 | 11,200 |

Prices were estimates — CKay admin can adjust `costPrice`/`baseSellingPrice`.
Product-supplied `baseSellingPrice` is honored over `calculatePriceFromRevenueModel`
(fallback markup 25% only applies when sell price is omitted).

## SubProduct service gotchas (avoid re-learning)

- **Populate needs all models registered.** Calling `createSubProduct(...)` from a
  standalone script fails at the final `.populate` with
  `Schema hasn't been registered for model "Brand"` unless the script also
  `require`s the Brand (and Category) models before running. The Express server
  registers everything, so this never happens in the API path.
- **Non-transactional mode persists before it throws.** On this branch
  (`isTransactionSupported()` false), `createSubProductCore` fully saves the
  SubProduct + `unit` Size + product/tenant counters, then the wrapper's populate
  (line ~1149) throws — so a "failed" call can still leave a complete SubProduct
  in the DB. Always verify state after a failure; never blindly re-run.
- Temp scripts must be written with the Write tool into `server/` and run as
  `node -r dotenv/config <file>.js` (bash heredocs break due to persistent-shell
  CWD). Delete on success. Atlas M0 connections blip often — wrap in a retry loop.

## Follow-ups

- Super-admin: approve the 4 pending Products to make them visible on the
  main marketplace.
- Platform app Vercel: add `*.drinksharbour.com` wildcard domain.

## Subsequent session — sub-product page empty state (2026-09-17)

Improvement to `client/apps/admin` sub-product list page:

- `sub-product-list/components/states.tsx` `EmptyState` now takes a
  `variant` prop: `'empty'` (tenant has zero sub-products) vs `'no-results'`
  (catalog exists, filters hide everything), plus optional `onAddProduct` /
  `onCreateSubProduct` / `hasActiveFilters` callbacks.
- True-empty now reads "No products yet" with a red **Add Product** CTA
  (`routes.eCommerce.createProduct` → `/products/create`) and a secondary
  **New Sub-product** CTA (`/sub-products/create`). Filtered-empty keeps an
  "Add Product" secondary under "Clear Filters".
- Call sites updated in `sub-product-list/table.tsx` (true-empty branch ~L715,
  filtered-empty ~L1008). Both files are `@ts-nocheck`; `filtering.test.ts`
  (35 tests) passes.

## Subsequent session — sub-product list page design pass (2026-09-17)

User-approved direction (via brainstorming Q&A): overall full pass, **refine
current look** (white cards + brand red `#b20202` + beverage pastel gradients,
no rebuild), **real stat trends** (no fake percentages), **listing page only**
(create/edit wizard untouched).

Implemented:

- **New `components/SubProductsHeader.tsx`** — page title ("Sub-Products"),
  real subtitle ("N items available in your store · M low on stock"), and the
  two create actions moved OUT of the toolbar here: **Add Product** (outline)
  and **New Sub-product** (red primary). Used in all four render branches
  (loading/error/empty/main).
- **`StatsHeader` (states.tsx)** — dropped the hardcoded "+12%/+5%/-3%/+2%"
  trend rows; footer is now "Added in 30 days" with a real `+N` green pill
  (or a neutral `0`) from the new optional `trends?: number[]` prop (card
  order: total, active, low stock, out of stock). Unused `PiTrendDownBold`
  import removed.
- **`table.tsx`** — trends computed client-side (no backend change): a
  `useMemo` filters the already-fetched catalog by `createdAt` within the last
  30 days, counting per status bucket (low-stock rule matches the hook:
  `totalStock > 0 && <= 10`). `SubProductsHeader` + `StatsHeader` added to the
  main render (below header, above toolbar). Toolbar row 1 lost its
  New/Add-Product buttons (now in the header); `PiPlus`/`PiPackageBold`
  imports removed. Status pills (row 2) intentionally kept — "mini-Odoo"
  stat-cards + filter-pills pattern.
- **`ProductGridCard.tsx`** — subtle inner vignette on the gradient image
  area; name 13→14px (`text-sm`) semibold; price 13→14px bold tabular;
  grid hover `shadow-lg` + `shadow-[#b20202]/10` (red-tinted lift); compact
  card name 11→12px, hover `shadow-md` + red tint.

Verification: `filtering.test.ts` (35) passes; `tsc --noEmit` shows only
pre-existing errors (none in the touched files); `next lint` can't run in this
pnpm workspace-root setup, so lint is manual. No dev server was running, so no
screenshots taken.

Follow-up: optionally boot the admin app (`npm run dev` via pnpm from
`client/apps/admin`, env in `.env`) to eyeball the page against
`admin@ckay.drinksharbour.com`.

## Subsequent session — Sell Without Size Variants confirmation gate (2026-09-18)

Feature work on `/sub-products/[id]/edit` (create-edit form), brainstorming →
design → plan → subagent-driven TDD implementation. Full detail in
`docs/superpowers/specs/2026-09-17-sell-without-size-variants-toggle-design.md`
and `RESUME-sell-without-size-variants-toggle.md`.

Decisions (user): confirmation + safety; size rows stay hidden (never deleted,
toggling back restores); Approach A (confirm Modal + validation awareness +
inline notice).

Implemented:

- `sizes.tsx` — Switch gate: turning ON with ≥1 configured size opens a red
  `rizzui/modal` confirm ("Sell without size variants?"); Keep/Variant actions;
  amber "Selling as a single item" notice when ON.
- **Three-layer validation guard** so hidden rows never block a save:
  1. `validators/sub-product.schema.ts` — row `size` relaxed to
     `z.string().default('')`; superRefine "size is required" gated on
     `!sp.sellWithoutSizeVariants` (was blocking `handleSubmit`).
  2. `create-edit/validation.ts` (NEW pure helper `validateSizeVariants`) +
     `index.tsx` — inline guards extracted; skips in single-item mode. Needed
     because autosave/save-on-leave call `performSave(getValues(), true)`
     bypassing zod.
  3. Server unchanged (wipes to `unit` Size when flag ON).
- New tests: `validation.test.ts` (6), `sub-product.schema.test.ts` (3);
  regression `filtering.test.ts` (35). **44/44 pass**; tsc zero errors in
  touched files (449 pre-existing elsewhere); `next lint` unusable in this repo.

Key facts to retain: sizes validation exists in BOTH the zod schema and the
manual `performSave` guard (autosave path); schema `size` field is now
defaulted `''` with required-rule only in the gated refine. Commits:
`6ea9d461`, `026eaf16`, `dcda843a`, `ef5324d7` (feature); docs `321e5346`,
`f8c45294`, `7a47dfcc`.