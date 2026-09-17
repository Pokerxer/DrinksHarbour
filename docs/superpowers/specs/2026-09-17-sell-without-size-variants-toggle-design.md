# Design — Confirm before "Sell Without Size Variants"

Date: 2026-09-17
Status: **Approved** — implementation pending (see `RESUME-sell-without-size-variants-toggle.md` once done)
Files: `client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/sizes.tsx`, `.../index.tsx`

## Problem

Flipping the **Sell Without Size Variants** switch in the sub-product create/edit
form (`/sub-products/[id]/edit`) silently hides all configured size-variant rows.
On save, the server wipes every size and replaces it with a single auto-created
`Unit` Size. Sellers who toggle it by accident risk losing carefully-configured
variants with no warning.

Latent bug found during analysis: the manual size-validation guards
(`index.tsx:933-957` — missing-size-selection + duplicate-size-value) run
**regardless** of the toggle. Because hidden rows persist in the form (see
Decision below), a hidden incomplete row can block saving a single-item product.

## Decisions (from brainstorming, user-directed)

1. **Confirmation + safety** is the goal — not a UI/UX redesign, not a mode-control restructure.
2. **Keep hidden, restore when toggled back**: when the switch is turned ON the
   form's `sizes` array is *not* cleared — rows stay in the form, hidden.
   Toggling back OFF restores them (protects against mis-clicks).
3. **Approach A** (chosen): confirmation `Modal` gate on turn-ON with ≥1 size,
   validation-guard awareness for single-item mode, small inline notice.
   No "don't ask again", no segmented control.

## Behaviour

### 1. Toggle turnover — `sizes.tsx`

| Turn | Condition | Behaviour |
|---|---|---|
| ON  | `fields.length === 0` | Flip immediately, no dialog (nothing at risk) |
| ON  | `fields.length > 0`  | Hold switch OFF, open confirmation `Modal` |
| OFF | any                  | Flip immediately, no dialog (rows reappear; nothing destroyed) |

Confirmation modal (local state, `rizzui/modal`, same pattern as
`product-identification.tsx` → `CreateBrandModal`):

- **Title:** "Sell without size variants?"
- **Body:** "Your N configured size variant(s) will be replaced by a single Unit
  item when you save. They stay in this form until then — turn this back off to
  restore them."
- **Actions:** red primary **Sell Without Variants** → sets
  `sellWithoutSizeVariants = true`, closes. Neutral **Keep Size Variants** →
  leaves it off, closes.

### 2. Validation-guard skip — three layers (amended during planning)

Planning found the schema also enforces sizes independently of the toggle, so
"hidden rows never block a save" spans three layers:

1. **Form schema** — `src/validators/sub-product.schema.ts`: the per-row
   `size` rule (`sizeOptionSchema.size`, currently
   `z.string(...).min(1, ...)`) is relaxed to `z.string().default('')`, and the
   `subProductFormSchema` `superRefine` per-row "size is required" check
   (`:372-381`) is skipped when `sp.sellWithoutSizeVariants === true`. This
   stops `handleSubmit` from failing on hidden rows.
2. **Manual save guard** — `index.tsx:933-957` (missing-selection + duplicate
   checks): replaced by a pure exported helper
   `validateSizeVariants(sizes, sellWithoutSizeVariants)` returning `string[]`
   (empty in single-item mode). Needed because auto-save / save-on-leave call
   `performSave(getValues(), true)` directly, bypassing zod.
3. **Server** — unchanged: already discards the `sizes` payload when the flag
   is ON (`subproduct.service.js`).

### 3. Single-unit inline notice — `sizes.tsx`

When the toggle is ON, render a compact card under the switch (matching the
section's card styling): *"Selling as a single item — one price & one stock.
Price lives in **Pricing**, stock lives in **Inventory**."*

## Out of scope / unchanged

- Server (`subproduct.service.js` create `:1043-1080` / update `:1953-1971`
  Unit-Size wipe) — already correct, verified by `test-po-receive-fix.js`.
- `subProduct.transformer.ts` `transformFormData` — still ships `sizes` + flag;
  server discards sizes when flag ON.
- Consumers of the flag (POS `pos-sell.tsx`, `pos-combos.tsx`, purchases
  `purchases-*.tsx`, `sales-catalog-card.tsx`) — pattern
  `!p.sellWithoutSizeVariants && p.sizes.length > 0` unaffected.
- Autosave / draft (localStorage `subproduct-draft`) — the switch does not
  trigger saves today and will not.

## Edge cases

- Edit mode, product already single-unit in DB: toggle renders ON; the DB `Unit`
  row loads into the hidden form — flipping OFF shows that row. Acceptable, no dialog on OFF.
- Create mode toggled ON immediately: no sizes exist → no dialog.
- Modal while toggling: blocks input; confirm commits value, cancel restores.
- Duplicate-size guard in single-item mode becomes a dead path (skipped).

## Verification

- Regression: `npx vitest run src/app/shared/ecommerce/sub-product/sub-product-list/filtering.test.ts`.
- Manual: add sizes → toggle ON → modal → cancel restores → confirm hides table +
  shows notice → save → server Unit size exists (check sub-products list / POS).
- `pnpm exec tsc --noEmit` from `client/apps/admin` with env from
  `client/apps/admin/.env` — only pre-existing unrelated errors.
- Lint: unavailable in this repo (ESLint 9 / config mismatch at workspace root) —
  rely on vitest + tsc + review.

## Files touched

| File | Change |
|---|---|
| `create-edit/sizes.tsx` | Switch handler (modal gate), confirmation `Modal`, inline notice; import `Modal` from `rizzui/modal`, `useState` |
| `create-edit/index.tsx` | Replace inline size guards with shared `validateSizeVariants` helper (skips when `sellWithoutSizeVariants === true`) |
| `create-edit/validation.ts` | NEW — pure `validateSizeVariants(sizes, sellWithoutSizeVariants): string[]` |
| `validators/sub-product.schema.ts` | Relax `size` field to `z.string().default('')`; gate the per-row "size is required" `superRefine` on `!sellWithoutSizeVariants` |