const { productIds } = require('./warehouseHistory.filters');
const { round2 } = require('./stockTransfer.money');
const ref = (value) => String(value?._id || value || '');
const key = (item) => `${ref(item.subProductId)}:${ref(item.sizeId)}`;
function purchaseMetrics(doc, warehouse, product = '', returns = [], lineKeys = null) {
  const selected = productIds(product);
  const matches = (item) =>
    (!selected.length || selected.includes(ref(item.subProductId))) &&
    (!lineKeys || lineKeys.has(key(item)));
  const items = (doc.items || []).filter(matches);
  const receipts = (doc.partialReceipts || []).filter((receipt) => receipt.status !== 'cancelled');
  const costGroups = new Map();
  for (const item of items) {
    const quantity = item.quantity || 0;
    const unit =
      (quantity > 0 && Number.isFinite(item.totalCost)
        ? item.totalCost / quantity
        : item.unitCost || 0) *
      (1 + (item.taxRate || 0) / 100);
    const group = costGroups.get(key(item)) || { quantity: 0, value: 0, unit };
    group.quantity += quantity;
    group.value += quantity * unit;
    costGroups.set(key(item), group);
  }
  const costs = new Map(
    [...costGroups].map(([line, group]) => [
      line,
      group.quantity > 0 ? group.value / group.quantity : group.unit,
    ]),
  );
  const quantities = new Map();
  if ((doc.partialReceipts || []).length) {
    for (const receipt of receipts) {
      if (warehouse && ref(receipt.warehouseId || doc.warehouse) !== warehouse) continue;
      for (const item of receipt.items || []) {
        if (!matches(item) || item.status === 'cancelled') continue;
        quantities.set(key(item), (quantities.get(key(item)) || 0) + (item.quantityReceived || 0));
      }
    }
  } else if (!warehouse || ref(doc.warehouse) === warehouse) {
    for (const item of items)
      quantities.set(
        key(item),
        (quantities.get(key(item)) || 0) + (item.receivedQty || 0) + (item.returnedQty || 0),
      );
  }
  const activeReturns = returns.filter(
    (row) =>
      ref(row.purchaseOrder) === ref(doc) &&
      (!warehouse || ref(row.warehouse) === warehouse) &&
      row.stockAdjusted === true &&
      !['draft', 'cancelled', 'rejected'].includes(row.status),
  );
  let returnedQuantity = 0;
  let returnedValue = 0;
  for (const row of activeReturns)
    for (const item of row.items || []) {
      if (!matches(item)) continue;
      returnedQuantity += item.quantity || 0;
      returnedValue += Number.isFinite(item.amount)
        ? item.amount
        : (item.quantity || 0) * (item.unitPrice || 0) * (1 + (item.taxRate || 0) / 100);
    }
  // Old orders without return documents can use counters only when attribution
  // is unambiguous. A split receipt's global returnedQty cannot locate a return.
  const singleWarehouse =
    !warehouse ||
    (ref(doc.warehouse) === warehouse &&
      receipts.every((receipt) => ref(receipt.warehouseId || doc.warehouse) === warehouse));
  const documented = new Map();
  for (const row of returns) {
    if (
      ref(row.purchaseOrder) !== ref(doc) ||
      row.stockAdjusted !== true ||
      ['draft', 'cancelled', 'rejected'].includes(row.status)
    )
      continue;
    for (const item of row.items || [])
      documented.set(key(item), (documented.get(key(item)) || 0) + (item.quantity || 0));
  }
  if (singleWarehouse)
    for (const item of items) {
      const legacyQuantity = Math.max(
        0,
        (item.returnedQty || 0) - (documented.get(key(item)) || 0),
      );
      returnedQuantity += legacyQuantity;
      returnedValue += legacyQuantity * (costs.get(key(item)) || 0);
    }
  const receivedQuantity = [...quantities.values()].reduce((sum, qty) => sum + qty, 0);
  const receivedValue = [...quantities.entries()].reduce(
    (sum, [line, qty]) => sum + qty * (costs.get(line) || 0),
    0,
  );
  return {
    receivedQuantity,
    returnedQuantity,
    netReceivedQuantity: receivedQuantity - returnedQuantity,
    receivedValue: round2(receivedValue),
    returnedValue: round2(returnedValue),
    netReceivedValue: round2(receivedValue - returnedValue),
  };
}
function summarizePurchases(documents, warehouse, product, returns) {
  const currencies = new Map();
  for (const doc of documents) {
    const metrics = purchaseMetrics(doc, warehouse, product, returns);
    const currency = doc.currency || 'NGN';
    const row = currencies.get(currency) || {
      currency,
      ...Object.fromEntries(Object.keys(metrics).map((key) => [key, 0])),
    };
    for (const key of Object.keys(metrics)) row[key] += metrics[key];
    currencies.set(currency, row);
  }
  return [...currencies.values()].map((row) => ({
    ...row,
    receivedValue: round2(row.receivedValue),
    returnedValue: round2(row.returnedValue),
    netReceivedValue: round2(row.netReceivedValue),
  }));
}
module.exports = { purchaseMetrics, summarizePurchases };
