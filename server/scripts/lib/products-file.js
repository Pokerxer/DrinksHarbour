// scripts/lib/products-file.js
//
// Load the reconciled Cloud Bay → DrinksHarbour product match produced by the
// matching pass (scripts/seed-output/cloudbay-product-match.json).
//
// Each `final` row is one Product × SubProduct × Size that:
//   * matched a Cloud Bay SKU by name (exact, or size-insensitive),
//   * resolved to exactly one catalog size (either the volumes agreed, or the
//     catalog carries a single size and the source named none),
//   * belongs to an approved tenant with an active subscription,
//   * had stock > 0 and a sellable availability at match time.
//
// Rows the matcher rejected (volume mismatch, ambiguous size) are in `dropped`
// and are never returned here.
//
// IMPORTANT — quantities:
// `soldQty` is Cloud Bay's real 8-month volume and is frequently far larger
// than the catalog's current stock (e.g. Jameson Triple Distilled: 1,930 sold
// vs 3 in stock). Ordering soldQty would fail inventoryService.reserve(), so
// scaleQuantityToStock() below caps every line against real availability.

const fs = require('fs');
const path = require('path');

const DEFAULT_MATCH_FILE = path.resolve(
  __dirname, '..', 'seed-output', 'cloudbay-product-match.json',
);

/**
 * Group a set of matched rows by their central Product. Every row in the match
 * file has a productId; rows sharing it are the same beverage in different
 * sizes/drums.
 */
function _groupByProduct(rows) {
  const byProduct = new Map();
  for (const row of rows) {
    if (row && row.productId) {
      const key = String(row.productId);
      if (!byProduct.has(key)) byProduct.set(key, []);
      byProduct.get(key).push(row);
    }
  }
  return byProduct;
}

/** Attach a unique productKey so pool de-duplication can collapse by product. */
function _attachProductKey(row, index) {
  const key = String(row.productId || '');
  row.productKey = key
    ? `${key}:${row.subProductId}:${row.sizeId}`
    : `row-${index}`;
  return row;
}

/**
 * @param {string} [filePath]
 * @returns {{ rows: Array, dropped: Array }}
 */
function loadMatchedProducts(filePath = DEFAULT_MATCH_FILE) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Product match file not found: ${filePath}\n` +
      'Run the matching pass first, or pass --products-file.',
    );
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rows = (parsed.final || []).map((r, index) => ({
    productId:    r.productId,
    productName:  r.productName,
    productType:  r.productType,
    // subType is what makes review copy family-accurate (gin vs single malt vs
    // tequila all share type 'spirit'). Backfilled onto the match file from the
    // catalog; may be null for a handful of products.
    productSubType: r.productSubType || null,
    isAlcoholic:  r.isAlcoholic,
    subProductId: r.subProductId,
    tenantId:     r.tenantId,
    tenantName:   r.tenantName,
    sizeId:       r.sizeId,
    sizeName:     r.sizeName,
    stock:        Number(r.stock) || 0,
    price:        Number(r.price) || 0,
    minOrderQuantity: Number(r.min) || 1,
    maxOrderQuantity: r.max == null ? null : Number(r.max),
    // Provenance from the source report — used to weight how often a product
    // is picked, so high-volume SKUs appear in more orders.
    soldQty:      Number(r.soldQty) || 0,
    soldValue:    Number(r.soldValue) || 0,
    sourceName:   r.source,
    sourceCategory: r.cat,
  }));
  return { rows: rows.map(_attachProductKey), dropped: parsed.dropped || [] };
}

/**
 * Choose a per-line quantity that respects real stock and the size's own order
 * limits. Never returns more than `stockBudget`, which the caller decrements as
 * it builds orders so the whole run cannot oversell a single size.
 *
 * @param {object} row
 * @param {number} stockBudget    units still available for this size in this run
 * @param {() => number} random
 * @returns {number} 0 when the line cannot be ordered at all
 */
function scaleQuantityToStock(row, stockBudget, random = Math.random) {
  const min = Math.max(1, row.minOrderQuantity || 1);
  const hardMax = row.maxOrderQuantity || Infinity;
  const ceiling = Math.min(stockBudget, hardMax, 3); // keep lines realistic
  if (ceiling < min) return 0;
  return min + Math.floor(random() * (ceiling - min + 1));
}

/**
 * Build a weighted pick list. A product Cloud Bay sold 2,000 units of should
 * appear far more often than one it sold 5 of, otherwise the seeded order book
 * has a flat, obviously-synthetic product distribution.
 *
 * Weight is sqrt(soldQty) so the long tail still gets represented rather than
 * the top few SKUs swamping every order.
 *
 * @param {Array} rows                 matched rows (each carrying productId)
 * @param {object} [opts]
 * @param {Set<string>} [opts.multiProducts]  productIds with >1 sellable size
 * @param {number} [opts.multiBoost]          weight multiplier for those
 * @returns {Array<{ row: object, weight: number }>}
 */
function buildWeightedPool(rows, opts = {}) {
  const multiBoost = (opts.multiProducts && opts.multiProducts.size)
    ? (opts.multiBoost ?? 8)
    : 1;
  return rows.map((row) => {
    let weight = Math.max(1, Math.sqrt(row.soldQty || 1));
    if (multiBoost > 1 && opts.multiProducts.has(String(row.productId))) {
      weight *= multiBoost;
    }
    return { row, weight };
  });
}

const DEFAULT_SIZE_OPTIONS_FILE = path.resolve(
  __dirname, '..', 'seed-output', 'size-options.json',
);

/**
 * Load the size-variant universe that backs multi-size product lines.
 *
 * Cloud Bay's PDF priced each SKU at a single drum/size, but 17 catalog
 * subProducts carry 2–4 size variants each (1023 sizes / 1002 subproducts).
 * This file maps every size a matched subProduct actually owns — combining the
 * Cloud Bay sizes already present in `rows` with the ones found on the
 * subProduct document — so the seeder can rotate a product across its sizes
 * instead of always selling the single PDF-computed size.
 *
 * Envelope shape (what buildSizeOptions produces):
 *   {
 *     version: 1,
 *     refreshedAt: ISO,
 *     changed: ["LABEL 70cl... → soldQty 300"],
 *     products: { "<productId>": { product: ObjectId, variants: [variantLikeRow] } },
 *     unmatched: [{ label, sizes, skip }]
 *   }
 */
function loadSizeOptions(file = DEFAULT_SIZE_OPTIONS_FILE) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Size-options file not found: ${file}\n` +
      'Run scripts/buildSizeOptions.js first, or pass --multi-sizes-file.',
    );
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return raw;
}

module.exports = {
  DEFAULT_MATCH_FILE,
  DEFAULT_SIZE_OPTIONS_FILE,
  loadMatchedProducts,
  scaleQuantityToStock,
  buildWeightedPool,
  weightedPick,
  loadSizeOptions,
};

/** Weighted random pick from buildWeightedPool() output. */
function weightedPick(pool, random = Math.random) {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  if (total <= 0) return null;
  let t = random() * total;
  for (const p of pool) {
    t -= p.weight;
    if (t <= 0) return p.row;
  }
  return pool[pool.length - 1].row;
}

module.exports = {
  DEFAULT_MATCH_FILE,
  DEFAULT_SIZE_OPTIONS_FILE,
  loadMatchedProducts,
  scaleQuantityToStock,
  buildWeightedPool,
  weightedPick,
  loadSizeOptions,
};
