const { ValidationError } = require('../utils/errors');
const { returnLines } = require('./vendorReturn.stock');

async function validatePurchaseReturn(doc, tenantId, deps = {}) {
  if (doc.poCountersAdjusted) return;
  const lines = returnLines(doc.items);
  if (!doc.purchaseOrder) return;
  const Model = deps.PurchaseOrder || require('../models/PurchaseOrder');
  const po = await Model.findOne({ _id: doc.purchaseOrder, tenant: tenantId });
  if (!po) throw new ValidationError('Purchase order not found in this tenant');
  for (const line of lines) {
    const matching = po.items.filter(item => String(item.subProductId) === String(line.subProductId) &&
      String(item.sizeId || '') === String(line.sizeId || ''));
    const available = Math.max(0, matching[0]?.receivedQty || 0);
    if (line.quantity > available) {
      throw new ValidationError(`Cannot return more than the matching received purchase stock (${available} available)`);
    }
  }
}

module.exports = { validatePurchaseReturn };
