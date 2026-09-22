---
name: Beverage Field Zeros Normalization
description: Product save no longer fails on stale 0 in min-gated beverage fields (servingsPerContainer/volumeMl); normalization lives in Product pre-validate. Lambda ESM embedding fix + backfill script included.
type: memory
---

# Beverage Field Zeros Normalization

Full spec: `docs/superpowers/specs/RESUME-beverage-field-zeros.md`.

Key facts for future sessions:
- **Root cause**: `Product.servingsPerContainer`/`volumeMl` are `min: 1`. The
  admin edit form submits stale `0` from hidden non-beverage steps →
  `updateProduct` wrote it verbatim → `model.save()` failed "less than minimum
  allowed value (1)" → generic 400 "Some of the values submitted are invalid."
- **Fix**: `Product.pre('validate')` hook (`server/models/Product.js`,
  `NON_BEVERAGE_CLEAR_PATHS`) unsets beverage-only fields for non-beverage
  types and clamps zero `servingsPerContainer`/`volumeMl` (and out-of-range
  `vintage`) for beverages. This runs on EVERY `.save()` path — one choke point.
- `updateProduct` also clamps (`volumeMl`/`servingsPerContainer` only when
  `> 0`).
- Nested objects (`tastingNotes`, `servingSuggestions`) must be cleared
  per-sub-path via `doc.set('…sub', undefined)` — a parent namespace can't be
  removed as a single path; serialization then drops the container.
- **Lambda embedding**: `server/utils/embeddings.js` uses
  `await import('@xenova/transformers')` now (`require()` of ESM failed on
  Lambda every write).
- **Backfill**: `server/scripts/backfill-beverage-field-zeros.js`, dry-run by
  default (`APPLY=1` persists), reuses the hook via per-doc `.save()`.
- Tests: `server/__tests__/product.beverageFieldsNormalization.model.test.js`
  (model-level, no DB). Run: `cd server && node --test '__tests__/*.test.js'`
  → 2887 pass.