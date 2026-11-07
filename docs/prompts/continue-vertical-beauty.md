---
title: Continue per-business verticals — seed Beauty & Personal Care
date: 2026-11-03
status: ready-to-execute-one-vertical
---

# Prompt: continue with Beauty (copy into the engineering chat)

You are the principal engineer for DrinksHarbour, working in
`/Users/mac/Documents/drinksharbour` on branch `feat/plan-entitlements-billing`
(heavily dirty checkout — PRESERVE every unrelated modified/untracked file;
NEVER git add/reset/clean/commit/push; never print or transmit connection
URIs or credentials; sanitize any captured output).

## Context — read these first

- `docs/superpowers/specs/RESUME-general-saas-evolution-audit.md` — the full
  rollout ledger (sections: "Industry-expansion round", "Industry-scoping
  round", "Fashion vertical seeded", "Fashion sizes", "Electronics sizes").
- `docs/memory/general-saas-evolution-audit.md` — the compact memory entry.
- `server/constants/marketplaceTaxonomy.js` — the per-business registry
  (PER-BUSINESS model: each vertical owns its types + categories +
  subcategories; slugs derive via slugify; home-living ADOPTS the legacy
  category — adoption commented there).

## Where the rollout stands

| Vertical | Types (code) | Categories/Subcategories (DB) | Sizes |
|---|---|---|---|
| Beverage | ✅ legacy | ✅ legacy taxonomy | ✅ |
| Electronics | ✅ | ✅ seeded (9 cat / 29 sub) | ✅ storage/ram/screen/battery |
| Fashion | ✅ | ✅ seeded (8 cat / 33 sub) | ✅ alpha/numeric/waist/inseam/kids/shoes |
| **Beauty** | ✅ in code (7 types) | **❌ not seeded — THIS TASK** | ✅ volumes already exist |
| Home | ✅ in code | ❌ not seeded (awaiting go) | units/sets |
| Food Service & Venue | ✅ in code | ❌ not seeded (awaiting go) | venue serving v2 |

DB state: 74 categories / 931 subcategories. The industry-scope flag
(`INDUSTRY_TAXONOMY_SCOPE_ENABLED`) remains OFF; per-business visibility
activates only when the operator flips it per rollout — do NOT flip it.

## The Beauty vocabulary (already in the code registry — verify, then seed)

- Vertical: `Beauty & Personal Care` (slug `beauty`, industry `beauty`,
  businessTypes `['Beauty & Skincare']`, verticalTypes `['BEAUTY']`).
- Types (7, in code — nothing to seed): `beauty_skincare`, `beauty_makeup`,
  `beauty_hair`, `beauty_fragrance`, `beauty_nails`, `beauty_tool`,
  `beauty_hygiene` — all non-beverage; sizes are cosmetic container volumes
  that ALREADY exist in the Size enum (`15ml/30ml/50ml/100ml/200ml/250ml/
  500ml` via `STANDARD_SIZES.BEAUTY`) — NO new Size enum entries needed.
- Categories (5) → Subcategories (16):
  - Skincare → Cleansers & Toners, Moisturisers & Serums, Sun Care, Body Care
  - Makeup → Face, Eyes, Lips
  - Hair Care & Styling → Shampoo & Conditioner, Treatments & Oils, Styling Tools
  - Fragrance → Women's Fragrance, Men's Fragrance, Body Sprays & Mists
  - Personal Hygiene → Deodorants, Oral Care, Bath & Shower

## Execute (operator protocol — run from `server/`)

The seed script is idempotent and read-only by default; it loads `server/.env`
itself (never print the URI). Sequence:

1. Pre-checks (no DB): `node --check` on the touched files; run
   `node --test __tests__/productTypeRegistry.test.js __tests__/hospitalityCatalog.test.js
   __tests__/industryScope.test.js` and confirm green BEFORE touching the DB.
2. `node scripts/seed-marketplace-taxonomy.js --only=beauty` (preview):
   expect exactly **21 planned** (5 categories + 16 subcategories), all
   `industry: beauty`, zero name-mismatch throws. Probe the 21 slugs against
   BOTH collections first (the subcategories `slug_1` unique index is GLOBAL
   — an existing slug under any other parent must be reconciled before
   apply, never fought).
3. If the preview shows anything unexpected → STOP, sanitize, report.
4. `node scripts/seed-marketplace-taxonomy.js --only=beauty --apply`
   (expect 21 created).
5. `node scripts/seed-marketplace-taxonomy.js --only=beauty --apply` again
   (idempotency proof: 0 created).
6. Read-back verification (targeted countDocuments/findOne probes ONLY —
   full-collection cursors stall on this remote connection): categories
   **74 → 79**, subcategories **931 → 947**; all 5 beauty categories + 16
   subs exist with `industry: beauty` under correct parents; cross-vertical
   leak checks by name probe: `electronics` categories still exactly 9, no
   fashion leakage, `fresh-produce` absent; wine/beverage probes
   byte-identical; update the counts table in the RESUME section.
7. Client-side: NO change needed — the size pickers already consume the
   server size-guidance endpoint (`GET /api/products/size-guidance`), and
   beauty types resolve to the BEAUTY volume group; category dropdowns are
   server-filtered (flag still OFF, so forms unchanged until flipped).
   Verify by running the admin suites:
   `npx vitest run src/utils src/app/shared/ecommerce` (from client/apps/admin)
   + `./node_modules/.bin/tsc --noEmit` (0 errors) — no admin code edits
   expected this round.
8. Update `docs/superpowers/specs/RESUME-general-saas-evolution-audit.md`
   (append a "Beauty vertical seeded" section with counts + proofs) and
   `docs/memory/general-saas-evolution-audit.md` (one bullet).

## Hard rails

- Additive only: never rename/delete/reclassify existing docs; never touch
  beverage taxonomy; never seed another vertical in this run; never flip
  `INDUSTRY_TAXONOMY_SCOPE_ENABLED` or any flag; no commit/push/deploy.
- If a slug collision or name mismatch appears → STOP and report it as a
  reconciliation decision (the home-living adoption in the RESUME is the
  precedent for how to record one).
- Report: sanitized transcript, created table (name/slug/industry),
  idempotency proof, read-back counts, updated ledger links.

## Stopping condition

Beauty seeded + verified + documented = done. Then STOP and await the user's
direction for the next vertical (Home, then Food Service & Venue — the last
one interlocks with the venue machinery and needs its own careful pass).
Do not proceed to another vertical automatically.
