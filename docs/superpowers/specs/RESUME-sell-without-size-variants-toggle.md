# RESUME: Sell Without Size Variants — Confirmation Gate

Date: 2026-09-18
Status: **Complete — approved design, TDD-implemented, tested, typechecked**
Spec: `docs/superpowers/specs/2026-09-17-sell-without-size-variants-toggle-design.md`
Plan: `docs/superpowers/plans/2026-09-17-sell-without-size-variants-toggle.md`

## What was done

Made the "Sell Without Size Variants" toggle in the sub-product create/edit
form (`/sub-products/[id]/edit` → `create-edit/sizes.tsx`) **safe to use** and
made single-item mode **saveable with incomplete hidden rows**.

User-directed decisions (brainstorming): **confirmation + safety**; keep size
rows hidden (not deleted) so toggling back restores them; **Approach A**
(confirm Modal + validation awareness + inline notice — no "don't ask again",
no segmented mode control).

### Behaviour

1. **Toggle turnover** (`sizes.tsx`):
   - Turning ON with **0** configured sizes → flips immediately (nothing at risk).
   - Turning ON with **≥1** size → opens a red-header confirmation `Modal`
     ("Sell without size variants?") — **Keep Size Variants** leaves it off;
     **Sell Without Variants** sets the flag and closes. Rows are never
     deleted while in the form.
   - Turning OFF → always flips immediately (rows reappear; nothing destroyed).
2. **Inline notice** (`sizes.tsx`): when ON, an amber card under the switch —
   "Selling as a single item · One price & one stock. Price lives in Pricing,
   stock lives in Inventory."
3. **Three-layer validation guard so hidden rows never block a save:**
   - **Form schema** (`validators/sub-product.schema.ts`): the per-row `size`
     rule relaxed from `z.string(...).min(1)` to `z.string().default('')`, and
     the `superRefine` "size is required" loop is now gated on
     `!sp.sellWithoutSizeVariants` — `handleSubmit` can't fail on hidden rows.
   - **Manual save guard** (`create-edit/validation.ts` NEW + `index.tsx`):
     the old inline missing-selection + duplicate guards extracted to a pure
     `validateSizeVariants(sizes, bool) → string[]` (returns `[]` when the
     toggle is ON). Needed because auto-save / save-on-leave call
     `performSave(getValues(), true)` directly, bypassing zod.
   - **Server** — unchanged; already wipes sizes → single `unit` Size when the
     flag is ON (`subproduct.service.js` create `:1043-1080`, update
     `:1953-1971`).

### New files

- `create-edit/validation.ts` + `validation.test.ts` (6 tests)
- `validators/sub-product.schema.test.ts` (3 tests)

### Modified files

- `create-edit/index.tsx` (guards → helper)
- `create-edit/sizes.tsx` (gate + Modal + notice)
- `validators/sub-product.schema.ts` (size field relaxed + refine gated)

## Verification

- New + regression suites: **44/44** — `validation.test.ts` (6),
  `sub-product.schema.test.ts` (3), `sub-product-list/filtering.test.ts` (35).
- `pnpm exec tsc --noEmit` from `client/apps/admin` (env from `.env`): 449
  pre-existing errors repo-wide, **zero in any touched file** (`sizes.tsx` /
  `index.tsx` are `@ts-nocheck`; the new `.ts`/`.test.ts` files are clean).
- `next lint` remains unusable in this repo (workspace-root ESLint 9 vs
  `.eslintrc.json` mismatch) — skipped.
- Manual checklist (dev server) documented in plan Task 3 Step 6 — not run in
  this session (no dev server booted).

## Gotchas / notes for future sessions

- **Sub-product validator and form schema BOTH enforced sizes** before this
  work — hidden rows could block a save twice (zod `handleSubmit` + manual
  guard in `performSave`). Fixed at all layers; keep the `!sellWithoutSizeVariants`
  gate if the schema is touched again.
- `size: z.string().default('')` means `SizeOption.size` is now always a
  string; the required rule lives solely in the gated `superRefine` +
  `validateSizeVariants` helper.
- Duplicate-size message now reports the **first-seen** casing of a value
  (e.g. `" 50CL "` first-row) rather than the colliding row — matches the
  plan's approved test; negligible difference from the old inline guard.
- **Root-cause fix 2026-09-18 (`284bf3bb`)**: rizzui `Switch` forwards
  `onChange` to a native `<input type="checkbox">` (onChange is spread from
  props, not destructured — see `node_modules/rizzui/dist/chunk-LBI4SQ2B.mjs`).
  The toggle handler therefore received a `ChangeEvent`, not a boolean, and
  `setValue(..., checked)` was persisting the raw event (DOM node) into the
  form value → toggle stuck ON (truthy object) + autosave circular-JSON crash
  at `index.tsx` L731. Fixed by reading `event.target.checked` — the same
  pattern as all 8 sibling Switches in `create-edit/`.
- Autosave (`performSave(getValues(), true)`, bypasses zod) is why the manual
  guard had to stay toggle-aware — it was extracted to the helper, not removed.
- Commits: `6ea9d461` (schema), `026eaf16` (helper+index), `dcda843a`
  (sizes.tsx), `ef5324d7` (style nit), `284bf3bb` (toggle event fix); docs
  commits `321e5346`/`f8c45294`/`7a47dfcc`.

## Open follow-ups

- Boot the admin app and walk plan Task 3 Step 6 manually (esp. single-Unit
  size after save, and toggling back restoring rows).
- Confirm "sell without variants" toggle in the **create-new-product** flow
  behaves the same (covered by the same component + schema gates).