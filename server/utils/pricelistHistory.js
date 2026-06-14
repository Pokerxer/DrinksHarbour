// utils/pricelistHistory.js
//
// Pure, DB-free helpers for vendor-pricelist price history. Shared by the PO
// sync service and the manual-update controller so both log changes identically.

const HISTORY_CAP = 24;

/** Signed % change from prev -> next. Returns 0 when prev is missing/zero. */
function changePercent(prev, next) {
  const p = Number(prev) || 0;
  const n = Number(next) || 0;
  if (p <= 0) return 0;
  return Math.round(((n - p) / p) * 1000) / 10; // 1 decimal place
}

/**
 * Append a history entry to a line, capping at HISTORY_CAP (drop oldest) and
 * recording previousPrice/previousPriceDate from the line's pre-change value.
 * `entry` must include unitPrice, basePrice, source, changePercent and may
 * include date, poId, poNumber, userId.
 */
function pushHistory(line, entry) {
  if (!Array.isArray(line.priceHistory)) line.priceHistory = [];
  const prevEntry = line.priceHistory[line.priceHistory.length - 1];
  if (prevEntry) {
    line.previousPrice = prevEntry.unitPrice;
    line.previousPriceDate = prevEntry.date;
  }
  line.priceHistory.push({ date: new Date(), ...entry });
  if (line.priceHistory.length > HISTORY_CAP) {
    line.priceHistory.splice(0, line.priceHistory.length - HISTORY_CAP);
  }
}

/** Match an existing line to a PO/edit item by subProductId (+ sizeId rules). */
function findLine(items, target) {
  return items.find((p) => {
    const sameProduct =
      p.subProductId && target.subProductId &&
      p.subProductId.toString() === target.subProductId.toString();
    const sameSize = target.sizeId
      ? p.sizeId && p.sizeId.toString() === target.sizeId.toString()
      : !p.sizeId;
    return sameProduct && sameSize;
  });
}

/**
 * Apply validated-PO items onto a pricelist's items array (mutates in place).
 * Returns counts: { updated, added, changed }.
 * ctx: { now, userId, poId, poNumber }
 */
function applyPOItemsToPricelist(pricelist, poItems, ctx = {}) {
  const now = ctx.now || new Date();
  let updated = 0;
  let added = 0;
  let changed = 0;

  for (const it of poItems || []) {
    if (!it.subProductId) continue;
    const unit = Number(it.unitCost) || 0;
    if (unit <= 0) continue; // never overwrite with a zero/blank cost

    const existing = findLine(pricelist.items, it);

    if (existing) {
      updated++;
      if (unit !== existing.unitPrice) {
        const pct = changePercent(existing.unitPrice, unit);
        // Capture the pre-change price for the fast list-level delta. (pushHistory
        // only back-fills previousPrice from an existing history entry, which is
        // absent the first time a pre-existing line changes.)
        existing.previousPrice = existing.unitPrice;
        existing.previousPriceDate = existing.lastPriceUpdate;
        existing.unitPrice = unit;
        existing.basePrice = unit;
        if (it.sku) existing.sku = it.sku;
        if (it.packaging) existing.packaging = it.packaging;
        if (it.packagingQty) existing.packagingQty = it.packagingQty;
        existing.lastPriceUpdate = now;
        pushHistory(existing, {
          unitPrice: unit, basePrice: unit, date: now, source: 'po',
          poId: ctx.poId, poNumber: ctx.poNumber, userId: ctx.userId,
          changePercent: pct,
        });
        changed++;
      }
    } else {
      const line = {
        subProductId: it.subProductId,
        subProductName: it.subProductName || it.productName || 'Item',
        sku: it.sku,
        productName: it.subProductName,
        sizeId: it.sizeId,
        sizeName: it.sizeName,
        basePrice: unit,
        unitPrice: unit,
        discountPercent: 0,
        minQuantity: 1,
        leadTimeDays: 7,
        packaging: it.packaging,
        packagingQty: it.packagingQty || 1,
        isPreferred: false,
        lastPriceUpdate: now,
        priceHistory: [],
      };
      pushHistory(line, {
        unitPrice: unit, basePrice: unit, date: now, source: 'po',
        poId: ctx.poId, poNumber: ctx.poNumber, userId: ctx.userId,
        changePercent: 0,
      });
      pricelist.items.push(line);
      added++;
      changed++;
    }
  }

  return { updated, added, changed };
}

module.exports = { HISTORY_CAP, changePercent, pushHistory, findLine, applyPOItemsToPricelist };
