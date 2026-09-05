// Marketplace demand — real units sold through drinksharbour.com checkout.
//
// WHY THIS EXISTS
//
// `SubProduct.totalSold` is incremented by exactly one code path: the POS
// controller, i.e. in-store sales. Marketplace checkout writes an `Order` and
// never touches it. Anything ranking on `totalSold` alone therefore sees only
// the in-store slice of demand.
//
// On the live dataset that gap is total: the whole catalogue's
// SubProduct.totalSold sums to 29 units across 9 products, while Orders record
// 154 distinct products actually sold. 612 of 621 live products (98.5%) tie at
// zero, so `/shop?sort=popularity` was decided by its `_id` tiebreaker — i.e.
// insertion order, not popularity.
//
// This module supplies the missing half so a sort can rank on
// POS units + marketplace units.
//
// Related: `getBestsellers` in product.service.js solves the same gap inside
// Mongo with `$unionWith: 'orders'`. That works there because the ranking IS
// the query. Here the shop already has a large aggregation whose sort runs
// before pagination, so the demand figures are fetched once and injected as a
// literal lookup table — see buildDemandExpr.
//
// The durable fix for both is to write Sales/`totalSold` at marketplace
// fulfillment; see RESUME-bestsellers-section.md.

const mongoose = require('mongoose');

/**
 * Which orders count as demand.
 *
 * A purchase is an order that was paid for AND actually reached the customer.
 * Pending, cancelled or unpaid orders are not demand — counting them would let
 * an abandoned cart rank a product onto "Most Popular".
 */
const ORDER_DEMAND_MATCH = Object.freeze({
  status: { $in: ['delivered', 'shipped'] },
  paymentStatus: 'paid',
});

/**
 * Aggregate units sold per product from the orders collection.
 *
 * @param {mongoose.Model} Order
 * @returns {Promise<Array<{_id: mongoose.Types.ObjectId, totalSold: number}>>}
 */
const fetchOrderDemandRows = (Order) =>
  Order.aggregate([
    { $match: { ...ORDER_DEMAND_MATCH } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
      },
    },
  ]);

/**
 * Shape demand rows into a `{ [productId]: units }` lookup table.
 *
 * Keys are STRINGS: the aggregation looks them up with `{ $toString: '$_id' }`,
 * so an ObjectId key would never match and every product would silently read
 * as zero demand.
 */
function buildOrderDemandMap(rows = []) {
  const map = {};
  for (const row of rows) {
    if (row?._id == null) continue;
    const units = Number(row.totalSold);
    map[String(row._id)] = Number.isFinite(units) ? units : 0;
  }
  return map;
}

/**
 * An aggregation expression resolving to this product's marketplace units.
 *
 * The map is embedded as a `$literal` object and indexed by the document's own
 * id. That keeps the whole thing a single pipeline stage — no `$lookup` into
 * orders, no second pass — which matters because the sort has to run before
 * `$skip`/`$limit` or pagination ranks only the current page.
 *
 * `$ifNull` matters: an unsold product must read 0, not null. A null sort key
 * orders inconsistently against numbers.
 */
function buildDemandExpr(demandMap) {
  // A catalogue with no orders yet must still produce a valid expression —
  // `$getField` over an empty object is legal but pointless, and this is
  // cheaper and clearer.
  if (!demandMap || Object.keys(demandMap).length === 0) {
    return { $literal: 0 };
  }

  return {
    $ifNull: [
      {
        $getField: {
          field: { $toString: '$_id' },
          input: { $literal: demandMap },
        },
      },
      0,
    ],
  };
}

/**
 * Convenience: fetch + shape in one call. Returns `{}` on any failure so a
 * demand outage degrades the ranking rather than breaking the shop.
 */
async function getOrderDemandMap(Order) {
  try {
    return buildOrderDemandMap(await fetchOrderDemandRows(Order));
  } catch (error) {
    console.error('Error building order demand map:', error.message);
    return {};
  }
}

module.exports = {
  ORDER_DEMAND_MATCH,
  fetchOrderDemandRows,
  buildOrderDemandMap,
  buildDemandExpr,
  getOrderDemandMap,
};
