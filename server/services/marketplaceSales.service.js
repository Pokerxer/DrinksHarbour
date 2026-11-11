// server/services/marketplaceSales.service.js
//
// Tenant marketplace sales totals, derived from the ONE source the platform
// already uses to define marketplace revenue: POSTED sales_revenue journal
// entries with source 'marketplace' — the same rows the merchant settlement
// statements pay out on (see merchantFulfillment/settlement/journals.js).
// Storefront, POS and venue journals carry different `source` values and are
// never counted. Refunds post under `source: 'merchant_refund'` and do not
// reduce the gross figure — "total sales" is gross.
//
// The aggregate is denormalised onto Tenant.marketplaceSalesTotal (₦, account
// 4000 net credit) and Tenant.marketplaceSalesOrders (distinct refDoc count).
// Recomputation is always-from-scratch and idempotent, so any journal posting,
// reversal or status change self-heals the aggregate.

'use strict';

const mongoose = require('mongoose');

/** What the platform counts as a marketplace sale — matches settlement. */
const MARKETPLACE_SALES_MATCH = {
  entryType: 'sales_revenue',
  source: 'marketplace',
  status: 'posted',
};

/**
 * One row per tenant with marketplace sales journals:
 * { _id: tenantId, total: number, orders: number }
 */
async function salesRowsFor(tenantIds) {
  const match = { ...MARKETPLACE_SALES_MATCH };
  if (Array.isArray(tenantIds) && tenantIds.length) {
    match.tenant = { $in: tenantIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
  }
  return mongoose.model('JournalEntry').aggregate([
    { $match: match },
    { $unwind: '$lines' },
    // 4000 is the revenue account: credit − debit is the gross sale amount.
    { $match: { 'lines.account': '4000' } },
    {
      $group: {
        _id: { tenant: '$tenant', order: '$refDoc' },
        net: { $sum: { $subtract: [{ $ifNull: ['$lines.credit', 0] }, { $ifNull: ['$lines.debit', 0] }] } },
      },
    },
    {
      $group: {
        _id: '$_id.tenant',
        orders: { $sum: 1 },
        total: { $sum: '$net' },
      },
    },
  ]);
}

/**
 * Recomputes the denormalised marketplace sales aggregate on Tenant documents.
 *
 * @param {{ tenantIds?: Array<ObjectId|string> }} [opts]
 *   With tenantIds, resets exactly those tenants (0/0 when they have no
 *   marketplace journals). Without, syncs every tenant that has rows.
 * @returns {{ updated: number, totals?: Map<string, {total: number, orders: number}> }}
 */
async function recomputeMarketplaceSales({ tenantIds } = {}) {
  const Tenant = mongoose.model('Tenant');
  const rows = await salesRowsFor(tenantIds);
  const byId = new Map(rows.map((row) => [String(row._id), row]));

  // Explicit subset → reset all of them (absence means zero, not stale data).
  // No subset → sync exactly the tenants that currently have marketplace sales.
  const targets = Array.isArray(tenantIds) && tenantIds.length
    ? tenantIds.map((id) => String(id))
    : [...byId.keys()];
  if (!targets.length) return { updated: 0, totals: new Map() };

  const totals = new Map();
  const ops = targets.map((id) => {
    const row = byId.get(id);
    const total = Math.round(Number(row?.total) || 0);
    const orders = Number(row?.orders) || 0;
    totals.set(id, { total, orders });
    return {
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(id) },
        update: { $set: { marketplaceSalesTotal: total, marketplaceSalesOrders: orders } },
      },
    };
  });

  const result = await Tenant.bulkWrite(ops, { ordered: false });
  return { updated: result.modifiedCount ?? ops.length, totals };
}

module.exports = { MARKETPLACE_SALES_MATCH, salesRowsFor, recomputeMarketplaceSales };
