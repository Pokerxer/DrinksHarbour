# DRI-34 acceptance evidence — /inventory ten-surface frontend slice

Date: 2026-11-06 · Deliverer: DrinksHarbour Frontend Engineer · Issue: DRI-34
(board scope extension #9, children of DRI-2). Local/synthetic only — no
commit/push/deploy. Verification-review gated: issue moved to `in_review`,
NOT done.

## Scope executed

Per `docs/memory/pos-retail-accommodation.md`, "«/inventory ten-surface
enumeration»": three REAL client gaps (customer returns, procurement,
replenishment) + browser-view evidence sweep for checklist items 1/2/3+5/6/7
and 8 (no UI change, verification note).

Working tree note: the parallel backend slice (variant suggestions, rules
`size` populate, customer-returns identity) landed in the same shared tree
mid-run (`server/services/reorder.service.js`,
`server/services/customerReturns/evidence.js`). All client composes match the
emitted wire shapes exactly; no shared-file collisions (frontend owns
shared/inventory client files; backend owned server files).

## Real gaps — implementation

1. **Customer returns (item 4, client)**
   - `shared/inventory/customer-return-list.tsx` (desktop + mobile),
     `customer-return-detail.tsx`: render `customerReturnSizeLabel(row)` —
     `flatRowSizeLabel` compose over `{sizeName: row.size, colorName,
     optionName}`; identity-less rows resolve to the exact legacy `row.size`
     bytes.
   - `utils/print/customer-return.ts`: **untouched** — print keeps stored
     `row.size` snapshot bytes (recorded decision 2); test-pinned that the
     document NEVER contains composed identity.
   - Restock-targeting: the row exposes no target field in today's payload →
     detail shows nothing (no invented placeholder). UI is wired to the
     reserved ADDITIVE contract (`restockSizeId`/`restockSizeName`) and
     surfaces it the moment the backend emits it — recorded contract gap.
2. **Procurement (item 9, client)**
   - `inventory-procurement.tsx`: per-row shared composed label
     (`suggestionSizeLabel`) against the DRI-33 wire shape
     (`sizeId` + `size` + `displayName` + verbatim colour/option +
     packaging); sizeless rows byte-identical (no label element, no hand-off
     link); duplicate-row keys fixed by `subProductId:sizeId` only for
     size-scoped rows.
   - Raise PO hand-off (new `inventory-procurement-helpers.ts`): rows with
     the exact Size link to `/purchases/create?subProduct=…&size=…` — the
     identity pair the /purchases verified pickers expect, no picker logic
     duplicated. `/purchases/create` does not yet consume the params — that
     is a purchases-surface follow-up (no shared/purchases component edited).
3. **Replenishment (item 10, client)**
   - `inventory-replenishment.tsx` `ruleSizeLabel`: populated Size with
     colour/option → full shared label; populated identity-less beverage
     Size → `displayName`; no populated Size → today's exact row bytes.

## Evidence per checklist item (new focused suites, all green)

Synthetic rows span the full board matrix in every suite: 750ml volume
colourless + Case of 6 (4500) pack, 'Regular plate · Jollof portion' vs 'Goat
portion', Fashion 'M · Emerald' vs 'M · Ivory', option-only
electronics/home rows, identity-less legacy control.

| # | Surface | Suite(s) | Result |
|---|---|---|---|
| 1 | Transfers | `shared/purchases/stock-transfer-variant-nonmerge.test.tsx` — detail view + destination receive panel: **Emerald/Ivory do NOT merge** (real-flow stored composed snapshots `subProductName – M · Emerald` / `– M · Ivory`, plus portion/option rows, 750ml vs Case of 6, legacy `75cl` control); print pin: `buildTransferInvoice` stays at stored snapshot bytes and never re-composes beyond a bare stored `sizeName` | 3/3 |
| 2 | Receipts | `inventory-receipts-variant.test.tsx` — `sizeLabel` compose across all flavours on the receipts browser; partial receipt of ONE variant posts its own balances (10 → 16) and the Sibling row keeps its own pair (15 → 20), exactly one Emerald/Ivory cell each | 2/2 |
| 3+5 | Deliveries / Internal | `inventory-delivery-internal-variant.test.tsx` — movements browser rows compose per-variant identities in both presets; units headers are generic noun strings ('Units Issued' / 'Units Moved'); CSV export adds no beverage-only unit/volume/pack/abv columns | 3/3 |
| 4 | Customer Returns | `customer-return-identity.test.tsx` — list desktop + mobile cards, detail compose, restock-target conditional, print builder stored-bytes pin, per-flavour composer matrix | 6/6 |
| 6 | Adjustments | `inventory-adjustment-variant.test.tsx` — variant options keyed by exact sizeId (`sz-em`/`sz-iv` in the select values); count-preview per-variant (On hand 10 vs 30, never the aggregate 40); save posts `sizeId: 'sz-em'` | 2/2 |
| 7 | Physical Inventory | `inventory-stock-count-variants.test.tsx` — count sheets (mode "count") list the 9 flavours as 9 separate 'Apply' sheets per exact Size row; applied rounds post per Size row via `adjustStock { size: sz-em → 8, size: sz-iv → 30 }` | 2/2 |
| 8 | Scrap | `inventory-scrap-preset-note.test.ts` — **no UI change**; preset set pinned to the CEO-decided industry-agnostic default `['damaged','expired','theft','written_off']` ('Units Scrapped' noun unchanged; per-industry mapping stays prose) | 1/1 |
| 9 | Procurement | `inventory-procurement.test.tsx` — composed per-variant labels (6 flavour rows incl. colourless volume/pack variants), legacy row byte-identity (`td.textContent === 'Sancerre 750mlSKU-W1'`), Raise PO hrefs carry `subProduct`+`size`, compose matrix incl. defensive shapes, duplicate-key regression | 5/5 |
| 10 | Replenishment | `inventory-replenishment.test.tsx` — targeted Size labels (portions distinct, Emerald/Ivory distinct, '750ml' volume present), sizeless rule row byte-identical (`textContent === 'Sancerre 750ml'`), composer matrix | 3/3 |

## Suite counts (own runs, `vitest run`, 2026-11-06)

- New/changed-for-DRI-34 suites: **9 files / 27 tests green**.
- Whole `app/shared/inventory` vitest dir: **47 files / 388 tests green**
  (DRI-30 baseline was 39/364 — nothing regressed).
- `shared/inventory` + `shared/purchases` together: **77 files / 576 tests**.
- Full-admin `tsc --noEmit`: **0 errors**.

## Hard constraints audit

- No per-industry forks anywhere (all composes are the shared
  `size-variant-label` util flavours).
- Legacy/sizeless rows byte-identical (test-pinned DOM bytes for the
  procurement/replenishment controls; fallback chains preserved elsewhere).
- Print templates untouched: customer-return print, transfer print kept at
  stored snapshot bytes (both pinned).
- `tenant_staff` custom-permission gate / beverage-only `/platform`
  untouched. No commit/push/deploy.

## Coordination notes for the CEO/board

1. **Restock-target contract gap remains open** on the returns payload —
   frontend wiring is silent-fail (no placeholder) by decision.
2. **Raise-PO query-state consumption** on /purchases is a follow-up for the
   purchases surfaces (out of this slice's file ownership).
3. Legacy transfer lines whose stored `sizeName` snapshots predate the
   composed entry labels keep historical bytes (snapshot-authoritative);
   current create flow stores the composed snapshot going forward.
