/**
 * recalculate-order-profits.js
 *
 * One-time migration: recalculates vendorPayout (tenantRevenueShare) and
 * platformProfit (platformCommission) on every order item using the correct
 * pricing pipeline from utils/pricing.js.
 *
 * Previous bug: used tenant.platformMarkupPercentage (~2%) to back-calculate
 * vendorPayout, producing near-zero platform profit.
 * Correct formula: calcPlatformCostPrice(costPrice, baseSellingPrice, ...)
 *
 * Run: node scripts/recalculate-order-profits.js
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const Order      = require('../models/Order');
const SubProduct = require('../models/SubProduct');
const Size       = require('../models/Size');
const Tenant     = require('../models/Tenant');
const { calcPlatformCostPrice, DEFAULT_PLATFORM_MARKUP } = require('../utils/pricing');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('[Migration] Connected to MongoDB');

  // Fetch all orders (adjust status filter if needed)
  const orders = await Order.find({}).lean();
  console.log(`[Migration] Found ${orders.length} orders to process`);

  // Pre-load all SubProducts, Sizes, Tenants referenced in these orders
  const spIds     = new Set();
  const sizeIds   = new Set();
  const tenantIds = new Set();

  for (const order of orders) {
    for (const item of (order.items || [])) {
      if (item.subproduct) spIds.add(item.subproduct.toString());
      if (item.size)       sizeIds.add(item.size.toString());
      if (item.tenant)     tenantIds.add(item.tenant.toString());
    }
  }

  const [subProducts, sizes, tenants] = await Promise.all([
    SubProduct.find({ _id: { $in: [...spIds] } }).select('_id costPrice baseSellingPrice').lean(),
    Size.find({ _id: { $in: [...sizeIds] } }).select('_id costPrice sellingPrice').lean(),
    Tenant.find({ _id: { $in: [...tenantIds] } }).select('_id revenueModel markupPercentage commissionPercentage').lean(),
  ]);

  const spMap     = new Map(subProducts.map(s => [s._id.toString(), s]));
  const sizeMap   = new Map(sizes.map(s => [s._id.toString(), s]));
  const tenantMap = new Map(tenants.map(t => [t._id.toString(), t]));

  let updatedOrders = 0;
  let updatedItems  = 0;

  for (const order of orders) {
    let orderDirty = false;

    const newItems = (order.items || []).map(item => {
      const tenant        = tenantMap.get(item.tenant?.toString());
      const sp            = spMap.get(item.subproduct?.toString());
      const sz            = sizeMap.get(item.size?.toString());

      const revenueModel  = tenant?.revenueModel ?? 'markup';
      const markupPct     = tenant?.markupPercentage     ?? 25;
      const commissionPct = tenant?.commissionPercentage ?? 12;

      const costPrice          = sz?.costPrice     ?? sp?.costPrice      ?? 0;
      const tenantSellingPrice = sz?.sellingPrice  ?? sp?.baseSellingPrice ?? 0;

      let vendorCostPerUnit = calcPlatformCostPrice(costPrice, tenantSellingPrice, revenueModel, markupPct, commissionPct);
      if (!vendorCostPerUnit || vendorCostPerUnit <= 0) {
        vendorCostPerUnit = item.priceAtPurchase / (1 + DEFAULT_PLATFORM_MARKUP / 100);
      }

      const newVendorPayout   = Math.round(vendorCostPerUnit * item.quantity * 100) / 100;
      const newPlatformProfit = Math.round((item.itemSubtotal - newVendorPayout) * 100) / 100;

      // Only mark dirty if values actually changed
      if (
        Math.abs((item.tenantRevenueShare ?? 0) - newVendorPayout)   > 0.01 ||
        Math.abs((item.platformCommission ?? 0) - newPlatformProfit) > 0.01
      ) {
        orderDirty = true;
        updatedItems++;
        return {
          ...item,
          vendorPriceAtPurchase: Math.round(vendorCostPerUnit * 100) / 100,
          tenantRevenueShare:    newVendorPayout,
          platformCommission:    newPlatformProfit,
          tenantRevenueModel:    revenueModel,
          revenueRateAtPurchase: revenueModel === 'commission' ? commissionPct : markupPct,
        };
      }
      return item;
    });

    if (orderDirty) {
      const newPlatformTotal = newItems.reduce((s, i) => s + (i.platformCommission || 0), 0);
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            items:                   newItems,
            platformCommissionTotal: Math.round(newPlatformTotal * 100) / 100,
          },
        }
      );
      updatedOrders++;
    }
  }

  console.log(`[Migration] Done — updated ${updatedItems} items across ${updatedOrders} orders`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
