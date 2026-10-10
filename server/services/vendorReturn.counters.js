const { ValidationError } = require('../utils/errors');
const { returnLines } = require('./vendorReturn.stock');

async function syncPurchaseReturnCounters(doc, tenantId, action, deps = {}) {
  if (!doc.purchaseOrder) return;
  if (action === 'deduct' && doc.poCountersAdjusted) return;
  const Model = deps.PurchaseOrder || require('../models/PurchaseOrder');
  const po = await Model.findOne({ _id: doc.purchaseOrder, tenant: tenantId });
  if (!po) throw new ValidationError('Purchase order not found in this tenant');
  const adjustments = [];
  for (const line of returnLines(doc.items)) {
    const item = po.items.find(i => String(i.subProductId) === String(line.subProductId) && String(i.sizeId || '') === String(line.sizeId || ''));
    if (!item) throw new ValidationError('Matching purchase size not found');
    if (action === 'deduct') {
      if (line.quantity > (item.receivedQty || 0)) throw new ValidationError('Return exceeds received purchase quantity');
      const postedQty = Math.min(item.postedQty || 0, line.quantity);
      adjustments.push({ itemId: item._id, quantity: line.quantity, postedQty });
      item.receivedQty -= line.quantity;
      item.postedQty = Math.max(0, (item.postedQty || 0) - postedQty);
      item.returnedQty = (item.returnedQty || 0) + line.quantity;
    } else {
      const previous = (doc.poCounterAdjustments || []).find(a => String(a.itemId) === String(item._id));
      // Old confirmed returns changed only returnedQty; don't invent a receipt
      // increment when cancelling one of those legacy records.
      if (doc.poCountersAdjusted && previous) {
        item.receivedQty = (item.receivedQty || 0) + previous.quantity;
        item.postedQty = (item.postedQty || 0) + previous.postedQty;
      }
      item.returnedQty = Math.max(0, (item.returnedQty || 0) - line.quantity);
    }
  }
  await po.save();
  doc.poCountersAdjusted = action === 'deduct';
  doc.poCounterAdjustments = adjustments;
  await doc.save();
}

module.exports = { syncPurchaseReturnCounters };
