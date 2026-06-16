# POS Pricelist ↔ Shop/Warehouse Resolution — Design

**Date:** 2026-06-16
**Branch:** `feat/pos-pricelist-shop-resolution`

## Problem

Pricelists in the POS sell page are selected manually by the cashier and scoped by
**terminal** (`retail`/`wholesale`). This is disconnected from the **active shop**
(`dh-pos-shop`), which already resolves to a warehouse via
`resolveShopWarehouse(tenant, tenantId, shopId)`. There is no way to say "this shop
(or this warehouse) uses this pricelist," no default fallback, and the product
grid/cards apply whatever terminal-keyed pricelist happens to be selected — which may
be wrong for the active shop.

## Goals

1. Configure which **warehouse(es)** and **shop(s)** a pricelist applies to.
2. Mark one pricelist as the tenant **default** that all shops fall back to.
3. POS sell page **auto-resolves** the pricelist for the active shop, with an optional
   validated manual override.
4. Correct + clearly-shown price calculation in the product grid/cards driven by the
   resolved pricelist.

## Confirmed current state (verified)

- `Pricelist.js`: `{ name, currency, isSelectable, tenant, rules[] }` — no shop/warehouse/default.
- `resolveShopWarehouse` resolves built-in (`retail`/`wholesale`) and unbound shops to the
  tenant's default warehouse (`Warehouse.isDefault`).
- `getPOSProducts` (`pos.controller.js:1736`) resolves the shop's warehouse for **stock**
  and returns **raw** prices; client applies pricelist via `applyPricelistToProduct`.
- `createPOSOrder` (`pos.controller.js:1912`) **trusts** client `pricelistId`, re-applies
  rules server-side (`:2038`), snapshots only the **first** rule as `appliedPricelistRule`.
- `GET /pos/pricelists` (`pos.routes.js:106`) returns **all** `isSelectable:true` pricelists,
  unfiltered.
- Two disconnected client concepts: **`terminal`** (scopes carts + selected pricelist) and
  **`activeShop`** (scopes warehouse for stock). Switching shops changes neither terminal
  nor pricelist today.

## Design decisions (locked)

1. **Binding model:** both dimensions are first-class. Precedence shop → warehouse → default.
2. **Override semantics:** auto-resolved is the default; cashier may override only within the
   shop's **allowed set**; server re-validates and falls back to resolved if invalid.
3. **Display source of truth:** server resolves the pricelist; client applies the rules
   (keeps live qty-tier recalculation client-side, minimal churn).
4. **Override scope:** manual override is keyed by active shop and re-resolves on shop switch.

---

## Section 1 — Data model & binding semantics

`Pricelist.js` gains:

```js
shops:      [{ type: String }],                          // shop ids (custom subdoc ids + built-in 'retail'/'wholesale')
warehouses: [{ type: Schema.Types.ObjectId, ref: 'Warehouse' }],
isDefault:  { type: Boolean, default: false },
```

- `shops` is `[String]` so it holds both custom shop subdoc ids and built-in string ids
  uniformly — matching how `shopId` already arrives in queries.
- New index `{ tenant: 1, isDefault: 1 }`.

**Binding semantics:**

- **Unscoped** (no shop/warehouse bindings) + `isSelectable:true` → offered everywhere as a
  manual option. Every existing pricelist becomes this, preserving legacy behavior.
- **Bound** (has shop/warehouse bindings) → offered only where bound.
- **One `isDefault` per tenant**, enforced on create/update by flipping others off
  (mirrors `Warehouse.isDefault`).

**Resolution precedence** for active shop (`warehouseId = resolveShopWarehouse(...)`):

1. pricelist whose `shops[]` includes `shopId`
2. else pricelist whose `warehouses[]` includes `warehouseId`
3. else the `isDefault` pricelist
4. else none (grid shows raw prices)

**Tie-break:** same-tier multiple matches → deterministic by `createdAt` ascending, first wins.
Admin UI surfaces a soft warning when two pricelists bind the same shop.

**Migration/back-compat:** no data migration; missing fields read as `[]`/`false`. Existing
selectable pricelists keep working as unscoped manual options. Nothing auto-resolves until an
admin sets bindings or a default.

---

## Section 2 — Server resolution & order authority

**New `server/services/pricelist.service.js`:**

```js
resolveShopPricelist(tenant, tenantId, shopId)
  → { resolved, allowed, warehouseId }
enforceSingleDefault(tenantId, exceptId?)
```

- `resolved` = auto-resolved pricelist by precedence (or `null`).
- `allowed` = dedup of shop-bound ∪ warehouse-bound ∪ default ∪ unscoped-selectable — the set
  a manual override is validated against.

**Endpoints:**

- `GET /pos/pricelists?shopId=` → `{ pricelists: allowed (with rules), resolvedId }`.
  Without `shopId`, falls back to today's all-selectable list.
- `getPOSProducts` additionally returns `resolvedPricelistId` for the active shop.

**`createPOSOrder` authority:** compute `{ resolved, allowed }` from `shopId`. If client
`pricelistId` ∈ `allowed` → use it; else ignore and use `resolved`. Snapshot the pricelist
identity (`{ pricelistId, name }`) on the order plus applied rule ids per line. Sequential
rule-application math unchanged.

---

## Section 3 — Client store rewiring & display fix

Rewire pricelist scope from terminal to shop:

- `posPricelistOverrideAtom` — `atomWithStorage<Record<shopId, string|null>>('dh-pos-pricelist-override', {})`.
- `posResolvedPricelistAtom` / `posAllowedPricelistsAtom` — in-memory, populated from
  `GET /pos/pricelists?shopId=` on active-shop change.
- `usePOSPricelist()` returns **effective** = `allowed.find(_id === override[activeShopId]) ?? resolved`.
  `setSelectedPricelist` writes into the per-shop override map.
- `usePOSCart()` reads the same effective pricelist (drops terminal-keyed read) so totals and
  grid agree.
- `usePOSAvailablePricelists().load(token, shopId)` fetches shop-scoped allowed + `resolvedId`,
  re-runs on shop change.

**Display fix:** `applyPricelistToProduct()` remains the single applier, fed the effective
pricelist. `PricelistBreakdown` labels the active pricelist by name and shows an
**Auto vs Manual** chip. Live qty-tier recalc stays client-side.

Carts remain terminal-keyed (out of scope); only the pricelist dimension moves to shop.

---

## Section 4 — Admin UI (`pos-pricelists.tsx` + CRUD routes)

- Create/edit form gains: **Shops** multiselect (custom + built-in retail/wholesale),
  **Warehouses** multiselect, **Default** toggle.
- `pricelist.routes.js` `POST /` and `PATCH /:id` accept `shops`, `warehouses`, `isDefault`;
  `isDefault:true` calls `enforceSingleDefault` first.
- Soft warning when two pricelists bind the same shop.
- List view shows a "Default" badge and binding summary.

---

## Section 5 — Testing, back-compat & verification

- `server/__tests__/pricelist.service.test.js` (node:test): shop > warehouse > default;
  no-match → `null`; unscoped-selectable in `allowed` but never auto-resolved; built-in
  `'retail'` resolves via default-warehouse tier; tie-break determinism; tenant isolation;
  back-compat (no bindings behave as unscoped).
- Before merge: `cd server && node --test __tests__/` and
  `cd client/apps/isomorphic && npx tsc --noEmit` (ignore pre-existing TS2688).
- Feature branch, commit per task.

## Affected files

- `server/models/Pricelist.js` — new fields + index
- `server/services/pricelist.service.js` — **new**: resolveShopPricelist, enforceSingleDefault
- `server/routes/pos.routes.js` — `/pos/pricelists?shopId=`
- `server/controllers/pos.controller.js` — `getPOSProducts` resolvedPricelistId; `createPOSOrder` authority + snapshot
- `server/routes/pricelist.routes.js` — accept shops/warehouses/isDefault; enforce single default
- `server/__tests__/pricelist.service.test.js` — **new**
- `client/.../point-of-sale/store/index.ts` — shop-effective pricelist atoms/hooks
- `client/.../point-of-sale/api.ts` — getPricelists(token, shopId)
- `client/.../point-of-sale/pos-product-grid.tsx`, `pos-product-card.tsx` — effective pricelist + Auto/Manual chip
- pricelist picker component + checkout submit — effective pricelist
- `client/.../point-of-sale/pos-pricelists.tsx` — admin bindings UI
