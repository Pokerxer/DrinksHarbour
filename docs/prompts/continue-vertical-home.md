---
title: Continue per-business verticals — seed Home & Living
date: 2026-11-03
status: ready-to-execute-one-vertical
---

# Prompt: continue with Home (copy into the engineering chat)

You are the principal engineer for DrinksHarbour, working in
`/Users/mac/Documents/drinksharbour` on branch `feat/plan-entitlements-billing`
(heavily dirty checkout — PRESERVE every unrelated modified/untracked file;
NEVER git add/reset/clean/commit/push; never print or transmit connection
URIs or credentials; sanitize any captured output).

## Context — read these first

- `docs/superpowers/specs/RESUME-general-saas-evolution-audit.md` — the full
  rollout ledger (sections: "Industry-expansion round", "Industry-scoping
  round", "Vertical taxonomy DB seed", "Fashion vertical seeded", "Fashion
  sizes", "Electronics sizes").
- `docs/memory/general-saas-evolution-audit.md` — the compact memory entry.
- `server/constants/marketplaceTaxonomy.js` — the per-business registry
  (PER-BUSINESS model: each vertical owns its types + categories +
  subcategories; slugs derive via slugify; the Home vertical ADOPTS the
  legacy `home-living` category — adoption commented there).

## Where the rollout stands

| Vertical | Types (code) | Categories/Subcategories (DB) | Sizes |
|---|---|---|---|
| Beverage | ✅ legacy | ✅ legacy taxonomy | ✅ |
| Electronics | ✅ | ✅ seeded (9 cat / 29 sub) | ✅ storage/ram/screen/battery |
| Fashion | ✅ | ✅ seeded (8 cat / 33 sub) | ✅ alpha/numeric/waist/inseam/kids/shoes |
| Beauty | ✅ | ✅ seeded (5 cat / 16 sub) | ✅ existing ml volumes |
| **Home** | ✅ in code (8 types) | **❌ not seeded — THIS TASK** | ✅ units/sets already exist |
| Food Service & Venue | ✅ in code | ❌ not seeded (awaiting go) | venue serving v2 |

DB state: **79 categories / 947 subcategories**. The industry-scope flag
(`INDUSTRY_TAXONOMY_SCOPE_ENABLED`) remains OFF; per-business visibility
activates only when the operator flips it per rollout — do NOT flip it.

## The Home vocabulary (already in the code registry — verify, then seed)

- Vertical: `Home & Living` (slug **`home-living`** — ADOPTS the legacy
  category of the same name, which stays untouched as a published doc;
  industry `home`; businessTypes `['Home & Living']`; verticalTypes
  `['HOME']`).
- Types (8, in code — nothing to seed): `home_kitchen`, `home_cookware`,
  `home_decor`, `home_furniture`, `home_bedding`, `home_storage`,
  `home_cleaning`, `home_small_appliance` — all non-beverage.
- Sizes: units/sets only (`unit-single`, `set-*`) — ALL already exist in the
  Size enum; NO new Size entries needed.
- Categories (8) → Subcategories (24):
  - Kitchen & Dining → Dinnerware & Serveware, Drinkware, Kitchen Utensils
    & Gadgets, Food Storage
  - Cookware & Bakeware → Pots & Pans, Bakeware, Kitchen Smallwares
  - Home Decor → Wall Art & Clocks, Vases & Ornaments, Candles & Home
    Fragrance
  - Furniture → Living Room, Dining, Office & Study
  - Bedding & Textiles → Bedsheets & Duvets, Pillows & Protectors, Towels
  - Storage & Organisation → Baskets & Bins, Wardrobe Organisers
  - Cleaning & Household → Cleaning Tools, Laundry, Waste Bins
  - Small Appliances → Blenders & Mixers, Kettles & Irons, Fans & Coolers

## Known quirks for THIS vertical (expected, not anomalies)

1. The legacy `home-living` CATEGORY (published, no industry after the
   rollback unset) stays as-is — the seed must NOT create or modify it; its
   3 legacy subs (kitchen-and-dining, cleaning-and-utility, home-fragrance)
   stay unscoped/legacy-global.
2. The new tree includes a CATEGORY "Kitchen & Dining" (slug
   `kitchen-and-dining`) while the legacy SUBCATEGORY "Kitchen & Dining"
   (same slug) exists under the adopted category — different collections, so
   both can coexist; this was reviewed and accepted 2026-11-03 (flagged in
   the ledger for a future merge decision).
3. Slug probe before apply: none of the 24 new sub slugs should exist in the
   subcategories collection (the bundled-seed copies were deleted in the
   2026-11-03 rollback; if any exists → STOP, sanitize, report).

## Execute (operator protocol — run from `server/`)

The seed script is idempotent and read-only by default; it loads `server/.env`
itself (never print the URI). Sequence:

1. Pre-checks (no DB): `node --check` on touched files; run
   `node --test __tests__/productTypeRegistry.test.js __tests__/hospitalityCatalog.test.js
   __tests__/industryScope.test.js` and confirm green BEFORE touching the DB.
2. `node scripts/seed-marketplace-taxonomy.js --only=home-living` (preview):
   expect exactly **32 planned** (8 categories + 24 subcategories), all
   `industry: home`, zero name-mismatch throws. Probe the 24 sub slugs
   against the subcategories collection first (GLOBAL unique `slug_1`
   index — an existing slug under any other parent must be reconciled
   before apply, never fought).
3. If the preview shows anything unexpected → STOP, sanitize, report.
4. `node scripts/seed-marketplace-taxonomy.js --only=home-living --apply`
   (expect 32 created).
5. `node scripts/seed-marketplace-taxonomy.js --only=home-living --apply`
   again (idempotency proof: 0 created).
6. Read-back verification (targeted countDocuments/findOne probes ONLY —
   full-collection cursors stall on this remote connection): categories
   **79 → 87**, subcategories **947 → 971**; all 8 home categories + 24
   subs exist with `industry: home` under correct parents; the legacy
   home-living doc + its 3 legacy subs remain UNMODIFIED (no industry,
   status published); cross-vertical leak checks: electronics still 9
   categories, fashion still 8, beauty still 5, `fresh-produce` absent;
   wine/beverage probes byte-identical; update the counts table in the
   RESUME section.
7. Client-side: NO change needed — the size pickers already consume the
   server size-guidance endpoint (home types resolve to unit/set sizes) and
   category dropdowns are server-filtered (flag still OFF, so forms
   unchanged until flipped). Verify by running the admin suites:
   `npx vitest run src/utils src/app/shared/ecommerce` (from
   client/apps/admin) + `./node_modules/.bin/tsc --noEmit` (0 errors) — no
   admin code edits expected this round.
8. Update `docs/superpowers/specs/RESUME-general-saas-evolution-audit.md`
   (append a "Home vertical seeded" section with counts + proofs) and
   `docs/memory/general-saas-evolution-audit.md` (one bullet).

## Hard rails

- Additive only: never rename/delete/reclassify existing docs (including
  the adopted home-living family); never touch beverage/electronics/
  fashion/beauty taxonomy; never seed another vertical in this run; never
  flip `INDUSTRY_TAXONOMY_SCOPE_ENABLED` or any flag; no
  commit/push/deploy.
- If a slug collision or name mismatch appears → STOP and report it as a
  reconciliation decision (the home-living adoption in the RESUME is the
  precedent for how to record one).
- Report: sanitized transcript, created table (name/slug/industry),
  idempotency proof, read-back counts, updated ledger links.

## Stopping condition

Home seeded + verified + documented = done. Then STOP and await the user's
direction for the LAST vertical (Food Service & Venue — restaurants/
lounges/clubs; it interlocks with the venue machinery and needs its own
careful pass). Do not proceed to another vertical automatically.
