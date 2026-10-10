const VendorReturn = require('../models/VendorReturn');
const { purchaseMetrics } = require('./warehousePurchaseTotals');
const ref = (value) => String(value?._id || value || '');
/** Analytics is opt-in; ordinary lists avoid the return-ledger query. */
async function withPurchaseReceiptMetrics(orders, tenant) {
  if (!orders.length) return orders;
  const returns = await VendorReturn.find({
    tenant,
    purchaseOrder: { $in: orders.map((order) => order._id) },
    stockAdjusted: true,
    status: { $nin: ['draft', 'cancelled', 'rejected'] },
  }).lean();
  const returnsByOrder = new Map();
  for (const row of returns) {
    const id = ref(row.purchaseOrder);
    const rows = returnsByOrder.get(id) || [];
    rows.push(row);
    returnsByOrder.set(id, rows);
  }
  return orders.map((order) => {
    const key = (item) => `${ref(item.subProductId)}:${ref(item.sizeId)}`;
    const groups = new Map();
    for (const item of order.items || []) {
      const group = groups.get(key(item)) || { quantity: 0, count: 0 };
      group.quantity += item.quantity || 0;
      group.count++;
      groups.set(key(item), group);
    }
    const metrics = new Map(
      [...groups.keys()].map((line) => [
        line,
        purchaseMetrics(order, null, '', returnsByOrder.get(ref(order)) || [], new Set([line])),
      ]),
    );
    return {
      ...order,
      items: (order.items || []).map((item) => {
        const group = groups.get(key(item));
        // Receipt/return documents identify product + size, not PO line IDs.
        // Allocate a repeated key once, rather than copying its total per line.
        const share = group.quantity > 0 ? (item.quantity || 0) / group.quantity : 1 / group.count;
        return {
          ...item,
          receiptMetrics: Object.fromEntries(
            Object.entries(metrics.get(key(item))).map(([field, value]) => [field, value * share]),
          ),
        };
      }),
    };
  });
}
module.exports = { withPurchaseReceiptMetrics };
