# Vendor Pricelists — Auto-Sync, Price History & Sourcing

**Date:** 2026-06-14
**Status:** Approved (design)
**Area:** Purchases → `/purchases/pricelists`

## Problem

A vendor's pricelist is already auto-updated from the last validated purchase order
("last purchase wins", `vendorPricelistSync.service.js`, wired at
`purchaseOrder.controller.js:564`). But the current behaviour has gaps:

1. **No price-change visibility.** Old prices are silently overwritten. There is no
   audit trail, no "last synced from PO #", no delta, and no way to spot a large
   cost jump.
2. **No sync safety.** Auto-sync overwrites *every* matching line on *every*
   pricelist for the vendor, so a negotiated/manual catalogue can be clobbered by a
   one-off purchase.
3. **List/detail UI** does not surface sync provenance, source, or recency.
4. **Price Compare** only supports one-product-at-a-time lookup; there is no
   cheapest-vendor-per-product sourcing view.

## Goals

- Keep a full, capped price history per line, written on both PO sync and manual edit.
- Protect manual/negotiated pricelists from auto-sync; maintain a separate
  auto-managed list per vendor instead.
- Make sync state and price changes visible on the list and detail pages.
- Provide a cheapest-vendor-per-product matrix for sourcing decisions.

## Non-goals

- A separate price-event collection / data-warehouse-grade audit.
- Server-side currency conversion (stays client-side via `useExchangeRates()`).
- Changing how POs themselves are created/validated (only the post-validate hook
  semantics change).

## Approach decisions (confirmed)

- **A. Price history** lives embedded as a per-line `priceHistory[]` array, capped at
  the most recent 24 entries. One document, no joins, trivial delta/sparkline render.
- **B. Cheapest-per-product** is computed from a new server endpoint that returns a
  flattened product→vendor-prices matrix from active pricelists; the client
  normalizes to ₦ and flags the cheapest. Conversion stays where the rates already are.
- **C. Manual lock** is per-pricelist (`autoManaged` flag). Sync writes only to the
  vendor's auto-managed list. If a vendor has only manual lists, sync creates a
  separate auto-managed list and leaves the manual ones untouched.

## Data model — `server/models/VendorPricelist.js`

New top-level fields:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `source` | `'manual' \| 'auto'` | `'manual'` | Origin of the list; drives the Auto/Manual badge. |
| `autoManaged` | Boolean | `false` | When true, PO sync may write to this list. Auto-created lists are `true`. |
| `lastSyncedAt` | Date | — | When the list last received a PO sync. |
| `lastSyncedPO` | `{ id: ObjectId, poNumber: String }` | — | Provenance of the last sync. |

New per-line (`items[]`) fields:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `previousPrice` | Number | — | Price before the most recent change (fast list-level delta). |
| `previousPriceDate` | Date | — | When `previousPrice` was the active price. |
| `priceHistory` | `[ HistoryEntry ]` | `[]` | Capped log (max 24), newest last. |

`HistoryEntry`:

```js
{
  unitPrice: Number,        // price at this point
  basePrice: Number,        // base (pre-line-discount) at this point
  date: Date,
  source: 'po' | 'manual',
  poId: ObjectId,           // when source === 'po'
  poNumber: String,         // when source === 'po'
  userId: ObjectId,         // who triggered the change
  changePercent: Number,    // signed % vs the prior unitPrice (0 for first entry)
}
```

`HISTORY_CAP = 24`. On append, if `priceHistory.length > 24`, drop the oldest.
The most recent `priceHistory` entry always mirrors the line's current `unitPrice`.

### Migration

No formal migration needed: new fields are optional and default sensibly.
Existing lists read as `source: 'manual'`, `autoManaged: false`, empty history.

**Backfill note for sync targeting:** because existing auto-created lists were named
`"… — Auto Pricelist"` and have `source` defaulting to `'manual'`, the reworked
sync must treat a vendor's existing legacy auto list as a valid auto target on first
run (see sync algorithm) and stamp `source: 'auto'`, `autoManaged: true` on it, so we
don't spawn a duplicate list for vendors already synced under the old behaviour.

## Sync service rework — `server/services/vendorPricelistSync.service.js`

Signature unchanged: `syncVendorPricelistFromPO(po, tenantId, userId)`.

**Target selection (in order):**
1. An existing list for the vendor with `autoManaged: true` → use it.
2. Else, if the vendor has a single list whose name ends with `Auto Pricelist`
   (legacy auto list) → adopt it: set `source:'auto'`, `autoManaged:true`, use it.
3. Else, if the vendor has only manual list(s) → create a new auto-managed list,
   leave manual lists untouched.
4. Else (no lists at all) → create a new auto-managed list.

New/created lists get `source:'auto'`, `autoManaged:true`,
`name: "<vendor> — Auto Pricelist"`.

**Per PO item (`unitCost > 0`, has `subProductId`):**
- Match an existing line by `subProductId` + `sizeId` (same null/size rules as today).
- Compute `unit = Number(it.unitCost)`.
- If line exists and `unit !== existing.unitPrice`: set `previousPrice`/`previousPriceDate`
  from the current values, compute `changePercent`, update `unitPrice`/`basePrice`,
  append a `priceHistory` entry (`source:'po'`, poId/poNumber/userId), cap history,
  stamp `lastPriceUpdate`. (If `unit === existing.unitPrice`, no history entry.)
- If line is new: push it with an initial `priceHistory` entry
  (`source:'po'`, `changePercent: 0`).
- Stamp `lastSyncedAt = now`, `lastSyncedPO = { id: po._id, poNumber: po.poNumber }`.

Return shape extended: `{ pricelistId, created, updated, added, changed }` where
`changed` counts lines whose price actually moved.

Behaviour preserved: never overwrite with a zero/blank cost; non-blocking in the
controller (already wrapped in try/catch).

## Backend endpoints — `vendorPricelist.controller.js` + `vendorPricelist.routes.js`

1. **`POST /api/vendor-pricelists/:id/sync-now`**
   - Loads the list, resolves its vendor, finds the most recent **validated** PO for
     that vendor in the tenant, and runs `syncVendorPricelistFromPO` against *that
     list's vendor*. Returns the updated list + the sync result summary.
   - 404 if list not found; friendly message if the vendor has no validated PO yet.

2. **`GET /api/vendor-pricelists/matrix`**
   - Builds a flattened matrix across the tenant's **active, in-window** pricelists.
   - Groups priced lines by `subProductId` + `sizeId`. Each group:
     ```js
     {
       subProductId, sizeId, subProductName, sizeName, sku,
       vendors: [{
         vendorId, vendorName, pricelistId, pricelistName,
         currency, unitPrice, discountPercent, leadTimeDays, vendorProductCode,
       }]
     }
     ```
   - No currency conversion server-side; client converts + flags cheapest + spread.
   - Optional `?search=` to filter by product name/sku server-side.

3. **`updateVendorPricelist` enhancement**
   - Before saving, if `req.body.items` is present, diff each incoming line against
     the stored line (match by `subProductId` + `sizeId`; fall back to array index
     for blank/unmatched lines). When `unitPrice` changed, set
     `previousPrice`/`previousPriceDate`, compute `changePercent`, append a
     `priceHistory` entry (`source:'manual'`, `userId`), and cap history.
   - Continue to reject writes to `tenant`/`createdBy`.

Shared history helper (a small `server/utils/pricelistHistory.js`) holds
`HISTORY_CAP`, `pushHistory(line, entry)`, and `changePercent(prev, next)` so sync and
update use identical logic.

## Frontend

Service types (`vendorPricelist.service.ts`): add the new fields to `VendorPricelist`
and `PricelistItem`, a `HistoryEntry` type, `syncNow(id, token)`, and
`getMatrix(token, search?)`.

`BIG_JUMP_THRESHOLD = 25` (percent) lives in `purchases-pricelist-shared.tsx` with
helpers: `lineDelta(line)`, `isBigJump(line)`, and a `<PriceHistoryRow>` /
expandable history renderer.

### List page — `purchases-pricelists.tsx`
- KPI strip gains a **Price Alerts** card (count of lines across lists whose latest
  `changePercent` magnitude ≥ threshold) and an **Auto-managed** count.
- New **source filter** (all / auto / manual) alongside the status filter.
- Table: **Source** badge (Auto/Manual), **Last synced** relative time, and a small
  price-movement indicator (▲/▼) when the list has recent changes.
- Row actions add **Sync now** (calls `syncNow`, then reloads).

### Detail page — `purchases-pricelist-detail.tsx`
- Header: source badge, `autoManaged` toggle, "Last synced from PO <poNumber>" link,
  and a **Sync now from last PO** button.
- Quick-stats gains **Price alerts** (lines over threshold on this list).
- Save preserves `priceHistory`/new fields (the editor already spreads `...line`).

### Shared editor — `purchases-pricelist-shared.tsx`
- Each line shows a change indicator (▲/▼ % vs `previousPrice`), highlighted when a
  big jump.
- Expandable history row: date, old→new, source (PO #/manual), changePercent.
- `emptyLine()` and `commit()` initialize the new optional fields safely.

### Price Compare — `purchases-price-compare.tsx`
- Rewrite to the **cheapest-vendor-per-product matrix** via `getMatrix`.
- Product search box; one row per product/size showing the **best vendor** + ₦ price,
  **vendor count**, and **spread %** (max−min / min). Row expands to all vendors,
  cheapest highlighted (reusing the existing "Best" trophy styling).
- Keep ₦ normalization via `useExchangeRates()`; rows with no rate sort last and show
  "no rate", as today.

## Error handling

- Sync remains non-blocking on PO validation (existing try/catch retained).
- `sync-now` surfaces a toast on "no validated PO for this vendor"; never throws to the
  user as a 500 for that expected case.
- Matrix endpoint tolerates lists with missing/zero-price lines (filtered out).
- History cap enforced on every append to bound document size.

## Testing

- **Server:** unit-test the sync-service target-selection + history logic
  (manual-only vendor → new auto list; legacy-auto adoption; change vs no-change
  history append; cap enforcement) with the repo's test runner if Jest is configured;
  otherwise a small runnable Node script under `server/scripts/` plus manual run.
- **Client:** `tsc`/lint clean; manual walkthrough — validate a PO, confirm the auto
  list updates with a history entry and delta; toggle `autoManaged`; "Sync now";
  verify a manual price edit logs a manual history entry; open the cheapest matrix.

## File touch list

- `server/models/VendorPricelist.js` — new fields, history sub-schema.
- `server/utils/pricelistHistory.js` — shared history helpers (new).
- `server/services/vendorPricelistSync.service.js` — rework using shared helpers.
- `server/controllers/vendorPricelist.controller.js` — `syncNow`, `matrix`, update diff.
- `server/routes/vendorPricelist.routes.js` — two new routes.
- `client/.../services/vendorPricelist.service.ts` — types + 2 methods.
- `client/.../purchases/purchases-pricelist-shared.tsx` — helpers + history UI.
- `client/.../purchases/purchases-pricelists.tsx` — list redesign.
- `client/.../purchases/purchases-pricelist-detail.tsx` — detail additions.
- `client/.../purchases/purchases-price-compare.tsx` — matrix rewrite.
</content>
