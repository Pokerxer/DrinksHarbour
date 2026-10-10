const { computeTransferMoney, round2 } = require('./stockTransfer.money');
const ref = (value) => String(value?._id || value || '');
const blank = () => ({
  outgoingQuantity: 0,
  incomingQuantity: 0,
  returnedInQuantity: 0,
  returnedOutQuantity: 0,
  outgoingValue: 0,
  incomingValue: 0,
  returnedInValue: 0,
  returnedOutValue: 0,
  netOutgoingQuantity: 0,
  netIncomingQuantity: 0,
  netOutgoingValue: 0,
  netIncomingValue: 0,
});
function documentMoney(doc, selected) {
  const items = doc.items || [];
  const original = computeTransferMoney(items, doc.deliveryCharge || 0);
  const remaining = computeTransferMoney(
    items.map((item) => ({
      ...item,
      quantity: Math.max(0, (item.quantity || 0) - (item.returnedQty || 0)),
    })),
    doc.deliveryCharge || 0,
  );
  const events = doc.returns || [];
  const snapshots =
    events.length > 0 && events.every((event) => Number.isFinite(event.refundedValue));
  const refund = snapshots
    ? events.reduce((n, event) => n + event.refundedValue, 0)
    : original.total - remaining.total;
  if (!selected.length) {
    const net = Number.isFinite(doc.total)
      ? doc.total
      : Number.isFinite(doc.totalValue)
        ? doc.totalValue
        : remaining.total;
    return { gross: round2(net + refund), refund: round2(refund) };
  }
  const matches = (item) => selected.includes(ref(item.subProductId));
  const gross = original.lines.reduce(
    (n, line, index) => n + (matches(items[index]) ? line.lineTotal : 0),
    0,
  );
  const weight = (item, quantity) =>
    quantity *
    (item.costPrice || 0) *
    (1 - (item.discountRate || 0) / 100) *
    (1 + (item.taxRate || 0) / 100);
  let selectedRefund = 0;
  if (snapshots)
    for (const event of events) {
      const lines = event.lines || [];
      const totalWeight = lines.reduce(
        (n, line) => n + weight(items[line.itemIndex] || {}, line.quantity || 0),
        0,
      );
      const selectedWeight = lines.reduce(
        (n, line) =>
          n +
          (matches(items[line.itemIndex] || {})
            ? weight(items[line.itemIndex], line.quantity || 0)
            : 0),
        0,
      );
      selectedRefund += totalWeight > 0 ? (event.refundedValue * selectedWeight) / totalWeight : 0;
    }
  else {
    const all = items.reduce((n, item) => n + weight(item, item.returnedQty || 0), 0);
    const chosen = items.reduce(
      (n, item) => n + (matches(item) ? weight(item, item.returnedQty || 0) : 0),
      0,
    );
    selectedRefund = all > 0 ? (refund * chosen) / all : 0;
  }
  // Older events may have a value but no per-line snapshot. Derive the selected
  // share from returned quantities rather than silently reporting zero returns.
  if (snapshots && events.some((event) => !event.lines?.length)) {
    const all = items.reduce((n, item) => n + weight(item, item.returnedQty || 0), 0);
    const chosen = items.reduce(
      (n, item) => n + (matches(item) ? weight(item, item.returnedQty || 0) : 0),
      0,
    );
    selectedRefund = all > 0 ? (refund * chosen) / all : 0;
  }
  return { gross: round2(gross), refund: round2(selectedRefund) };
}
function summarizeTransfers(documents, warehouse, product = '') {
  const selected = product
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const currencies = new Map();
  const pairs = new Map();
  for (const doc of documents) {
    const items = (doc.items || []).filter(
      (item) => !selected.length || selected.includes(ref(item.subProductId)),
    );
    const inbound = ref(doc.destinationWarehouse) === warehouse;
    const quantity = items.reduce(
      (n, item) => n + (inbound ? item.receivedQty || 0 : item.transferredQty || 0),
      0,
    );
    if (!quantity) continue;
    const returned = items.reduce((n, item) => n + (item.returnedQty || 0), 0);
    const currency = doc.currency || 'NGN';
    const other = inbound ? doc.sourceWarehouse : doc.destinationWarehouse;
    const pairKey = `${ref(other)}:${currency}`;
    if (!currencies.has(currency)) currencies.set(currency, { currency, ...blank() });
    if (!pairs.has(pairKey))
      pairs.set(pairKey, {
        warehouseId: ref(other),
        warehouseName: other?.name || 'Warehouse',
        currency,
        ...blank(),
      });
    const { gross, refund } = documentMoney(doc, selected);
    for (const row of [currencies.get(currency), pairs.get(pairKey)]) {
      row[inbound ? 'incomingQuantity' : 'outgoingQuantity'] += quantity;
      row[inbound ? 'returnedOutQuantity' : 'returnedInQuantity'] += returned;
      row[inbound ? 'incomingValue' : 'outgoingValue'] += gross;
      row[inbound ? 'returnedOutValue' : 'returnedInValue'] += refund;
    }
  }
  const finish = (row) => ({
    ...row,
    outgoingValue: round2(row.outgoingValue),
    incomingValue: round2(row.incomingValue),
    returnedInValue: round2(row.returnedInValue),
    returnedOutValue: round2(row.returnedOutValue),
    netOutgoingQuantity: row.outgoingQuantity - row.returnedInQuantity,
    netIncomingQuantity: row.incomingQuantity - row.returnedOutQuantity,
    netOutgoingValue: round2(row.outgoingValue - row.returnedInValue),
    netIncomingValue: round2(row.incomingValue - row.returnedOutValue),
  });
  return {
    currencies: [...currencies.values()].map(finish),
    pairs: [...pairs.values()]
      .map(finish)
      .sort((a, b) => a.warehouseName.localeCompare(b.warehouseName)),
  };
}
function summarizeTransferMovements(documents) {
  const result = { moneyAvailable: false, ...blank() };
  for (const row of documents) {
    const key = row.parentMovement
      ? row.type === 'returned'
        ? 'returnedInQuantity'
        : 'returnedOutQuantity'
      : row.type === 'transfer_in'
        ? 'incomingQuantity'
        : 'outgoingQuantity';
    result[key] += Math.abs(row.quantity || 0);
  }
  result.netIncomingQuantity = result.incomingQuantity - result.returnedOutQuantity;
  result.netOutgoingQuantity = result.outgoingQuantity - result.returnedInQuantity;
  return result;
}
function movementNetQuantities(row) {
  const quantity = Math.abs(row.quantity || 0);
  if (row.parentMovement && row.type === 'returned')
    return { transferInQuantity: 0, transferOutQuantity: -quantity };
  if (row.parentMovement && ['transfer_out', 'return_out'].includes(row.type))
    return { transferInQuantity: -quantity, transferOutQuantity: 0 };
  return {
    transferInQuantity: row.type === 'transfer_in' ? quantity : 0,
    transferOutQuantity: row.type === 'transfer_out' ? quantity : 0,
  };
}
module.exports = { summarizeTransfers, summarizeTransferMovements, movementNetQuantities };
