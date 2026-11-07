# DRI-6 extension — /sales module frontend acceptance (DRI-13)

**Date:** 2026-11-06 · **Issue:** DRI-13 · **Owner:** Frontend Engineer agent
**Decision on record:** `docs/memory/pos-retail-accommodation.md` — "/sales module extension" and "/sales/analytics extension — 2026-11-06": *shared implementation generalizes; no per-industry sales forks; no widget forks.*
**Sequencing honored:** work started only after DRI-3 + DRI-11 released the shared sales folder. Local/synthetic only — **no commit/push/deploy/production action taken.**

## Deliverable 1 — scan drawer uses the shared label source

`client/apps/admin/src/app/shared/sales/sales-scan-drawer.tsx` — `buildSelection()` now composes the picked scan row's identity via the single client label source `client/apps/admin/src/utils/size-variant-label.ts` (`sizeVariantLabel`), exactly like the picker path (`product-line-search.tsx`) already does. Changed the two payload composition sites (`name`, `sizeName`); no second composer was forked.

| Retail type | Scan size row fields | Before (defect) | After |
|---|---|---|---|
| Fashion | `displayName 'M'`, `colorName 'Navy'`, `optionName 'Slim'` | `Shirt – M` (colour/option lost on scan path) | `Shirt – M · Navy · Slim` |
| Electronics | `optionName 'Wi-Fi'` | `Smart TV – ` displayName/size-only | `Smart TV – Wi-Fi` |
| Beauty | `displayName '30 ml'`, `optionName 'Warm sand'` | `Serum – 30 ml` | `Serum – 30 ml · Warm sand` |
| Home & Living | `displayName 'Walnut'`, `colorName 'Oak'` | `Chair – Walnut` | `Chair – Walnut · Oak` |
| General Retail | `displayName '1 kg'` | `Rice – 1 kg` | `Rice – 1 kg` (unchanged — no identity data beyond size) |
| Legacy beverage | `displayName '500 ml'`, no colour/option | `Water – 500 ml` | `Water – 500 ml` — **byte-identical** |

Legacy equivalence is structural: `sizeVariantLabel` = `[displayName ?? size, colorName, optionName].filter(Boolean).join(' · ')`, so colourless/optionless rows collapse to the old string.

## Deliverable 2 — sales analytics product dim keeps variant identity

`sales-analytics/sales-analytics-helpers.ts` `resolveSalesItemDimKey('product')` now mirrors the POS order-analysis rule (`point-of-sale/analysis/measures.ts` — `variant ? `${name} · ${variant}` : name`):

```
before: item.name || item.sku || 'Unknown'
after : item.variant ? `${item.name || item.sku || 'Unknown'} · ${item.variant}` : (item.name || item.sku || 'Unknown')
```

`variant?: string` was added (optional) to `SalesLineItem` (`client/apps/admin/src/services/salesOrder.service.ts`) — additive, no existing call sites change meaning; legacy beverage rows (no `variant`) are byte-identical. No per-industry branching.

**Data-reality note (audit):** the `/api/sales-orders` list endpoint used by `/sales/analytics` does not populate `items.size` and the sales server stores no `variant` field, so on this surface the differentiating identity lives in the *stored line name snapshot*. Since the DRI-6 picker change route `displayName` through `sizeVariantLabel`, newly picked variant lines embed the full `M · Navy · Slim` identity in `name` and split correctly. Lines picked **before** that change composed `name` size-only; same-named pre-fix colour rows therefore cannot be split client-side from stored data — that is a server/encoding-phase concern, not this package. The mirrored rule centrally enforces `name · variant` for any load that does carry variant data (POS parity, future enrichment).

Pivot/widgets verified to render the new key unperturbed: keys are plain strings through `computeSalesGroupData`/`computeSalesMultiSeries`/`computeSalesHierarchicalPivot`; no hard-coded key assumptions exist in `sales-analytics-pivot.tsx` or the widgets.

### Extension #3 — four analyses, generic identity tests (all in `sales-analytics-helpers.test.ts`)

- **Products dim:** two colourways of one fashion product produce distinct `name · variant` keys; electronics option rows (`Wi-Fi` / `Cellular`) split; legacy beverage row `Hennessy VSOP – 750 ml` unchanged; nameless rows keep the pre-existing sku fallback.
- **Salespersons dim:** focused test pins `'Unassigned'` for unattributed docs (empty/undefined `salesperson`) and per-staff bucketing (`Ada` ≠ `Bola`). Marketplace-routed orders intentionally read `Unassigned` — decision on record, no label change.
- **Customers dim:** `'Walk-in Customer'` fallback pinned for missing/empty/nameless snapshots, plus named-customer bucketing with no beverage-category assumptions.
- **Revenue over time:** monthly/weekly buckets split seeded orders across all five retail types (Fashion, Electronics, Beauty, Home & Living, General Retail) — five distinct month keys, five distinct week keys, same-month/different-week split. Taxonomy fallbacks `'Uncategorized'` / `'No Brand'` pinned **audit-only** (existing generic rule, unchanged).

## Deliverable 3 — retail-label tests for sales line entry

New `client/apps/admin/src/app/shared/sales/product-line-search.test.tsx` (mirrors `shared/purchasing/retail-variant-line-search.test.tsx`):

- exact-search + expand renders `M · Navy · Slim` / `M · Black · Regular` and `Wi-Fi` (option-only identity), and `pickSize` emits `name: 'Shirt – M · Black · Regular'`, raw `sizeId: 'black-row'`, composed `sizeName`, price/units-per-pack per the existing fallback rule;
- electronics option row covers "optionName for electronics/shade storage" storage paths — the composed identity is what the line stores, colour/option title text is asserted in the row rendering;
- legacy beverage row renders `500 ml` and picks `Water – 500 ml` byte-identically to the pre-change composition.

Parallel coverage note (audit): the (uncommitted, other-run) `shared/purchases/retail-variant-line-search.test.tsx` already renders the **sales** picker too; this dedicated file keeps the DRI-13 deliverable independent of that run's workspace state.

## Audit-only — observed, NOT changed (per decision)

1. **`MonthlyTrendCard` raw-total aggregation** (`sales-analytics-widgets.tsx` ~L69 `cur.amount += o.total ?? 0`, vs the chart engine's line-level totals converted via exchange rates): generic NGN-safe inconsistency, deliberately **not** fixed in this package — flagged for the multi-currency phase.
2. **Quotations included in default revenue** unless `type_order` filtered: pre-existing intended behavior (covered by existing helpers tests), unchanged.
3. **Beverage-flavored comment text** in `sales-analytics-widgets.tsx` (~L225–236, `TopProductsCard` lager/cognac doc): left as-is (file not otherwise touched by this package).

## Verification

| Check | Result |
|---|---|
| `vitest run` — `product-line-search.test.tsx`, `sales-analytics-helpers.test.ts`, `retail-variant-line-search.test.tsx`, `pos-size-color.test.ts` | **4 files, 51 tests passed** |
| `tsc --noEmit` (client/apps/admin), touched files (`sales-scan-drawer.tsx`, `sales-analytics-helpers*.ts`, `salesOrder.service.ts`, `product-line-search.test.tsx`) | **clean — zero errors** |
| Pre-existing unrelated errors | 3 in `src/components/price-checker/use-compare-backup.test.ts` (concurrent workspace state of another run; untouched by DRI-13) |
| Legacy beverage regression | byte-identical labels pinned in both new test files |

Browser evidence stays with DRI-3's acceptance runs, as sequenced.
