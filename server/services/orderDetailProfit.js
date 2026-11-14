'use strict';

const { normalizeTenantId: id } = require('../utils/tenantContext');

function addOrderDetailProfit(order) {
  if (
    order.source === 'pos' || order.settlementOwner === 'tenant' ||
    order.tableServiceBooking || order.venueServiceSession || order.venueBillForSession ||
    (order.channelSnapshot && order.channelSnapshot.kind !== 'marketplace')
  ) return order;

  let hasWholesale = false;
  let profitAdjustmentMinor = 0;
  const items = order.items.map(item => {
    // Legacy orders have no wholesale snapshot. Only use the exact purchased
    // size, and check its listing, tenant and currency before using live data.
    const size = item.size;
    const matchingSize = id(item.subproduct) && id(item.tenant) &&
      id(size?.subproduct) === id(item.subproduct) && id(size?.tenant) === id(item.tenant) &&
      (size.currency ?? 'NGN') === order.currency;
    const wholesale = item.platformWholesaleUnitCostAtPurchase ?? (matchingSize ? size.wholesalePrice : 0);
    if (!Number.isFinite(wholesale) || wholesale <= 0) return item;

    const netMerchandise = item.revenueBasisAmount ?? (item.itemSubtotal - (item.discountAmount ?? 0));
    const costMinor = Math.round(wholesale * item.quantity * 100);
    const netMinor = Math.round(netMerchandise * 100);
    if (!Number.isSafeInteger(costMinor) || !Number.isSafeInteger(netMinor)) return item;

    hasWholesale = true;
    const recordedProfit = item.platformCommission ?? (netMerchandise - (item.tenantRevenueShare ?? 0));
    profitAdjustmentMinor += netMinor - costMinor - Math.round(recordedProfit * 100);
    return { ...item, platformWholesaleUnitCost: wholesale };
  });

  if (!hasWholesale) return order;
  const recordedProfit = order.platformCommissionTotal ?? order.items.reduce(
    (sum, item) => sum + (item.platformCommission ?? 0), 0
  );
  return { ...order, items, platformProfit: (Math.round(recordedProfit * 100) + profitAdjustmentMinor) / 100 };
}

module.exports = { addOrderDetailProfit };
