// Read-only composition: Sales owns stock returns; POS owns paid refunds.
const id = value => String(value?._id || value || '');
const qty = value => Math.max(0, Number(value) || 0);

function matchingLine(order, item) {
  const candidates = (order.items || []).filter(line =>
    line.subproduct && id(line.subproduct) === id(item.subproduct) &&
    (!line.lineType || line.lineType === 'product'));
  const exact = candidates.filter(line => id(line.size) === id(item.size));
  if (exact.length === 1) return exact[0];
  // A POS sale may resolve the default size of an originally unsized quote.
  if (candidates.length === 1 && !candidates[0].size) return candidates[0];
  return null;
}

function buildLinkedReturnState(salesOrder, receipts) {
  const state = { posReturnedByLine: {}, salesByReceipt: {} };
  const linked = receipts.filter(receipt => id(receipt.tenant) === id(salesOrder.tenant) &&
    [salesOrder._id, salesOrder.convertedFrom].filter(Boolean).map(id).includes(id(receipt.linkedSalesOrder)))
    .sort((a, b) => (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()) || id(a._id).localeCompare(id(b._id)));
  const slots = [];
  for (const receipt of linked) {
    (receipt.items || []).forEach((item, index) => {
      const line = matchingLine(salesOrder, item);
      if (!line) return;
      let refunded = 0, overlap = 0;
      for (const refund of receipt.refunds || []) {
        if (refund.source === 'sales') continue;
        for (const row of refund.items || []) {
          if (row.orderItemIndex !== index) continue;
          refunded += qty(row.quantity);
          overlap += Math.min(qty(row.quantity), qty(row.salesReturnedQuantity));
        }
      }
      const posOnly = Math.min(qty(item.quantity), Math.max(0, refunded - overlap));
      const key = id(line._id);
      state.posReturnedByLine[key] = (state.posReturnedByLine[key] || 0) + posOnly;
      slots.push({receipt: id(receipt._id), index, line, capacity: Math.max(0, qty(item.quantity) - posOnly), overlap});
    });
  }
  for (const line of salesOrder.items || []) {
    let remaining = Math.min(qty(line.returnedQty), qty(line.fulfilledQty));
    const matches = slots.filter(slot => id(slot.line._id) === id(line._id));
    const allocate = (slot, amount) => {
      const take = Math.min(remaining, slot.capacity, amount);
      if (take <= 0) return;
      const rows = state.salesByReceipt[slot.receipt] ||= {};
      rows[slot.index] = (rows[slot.index] || 0) + take;
      remaining -= take;
      slot.capacity -= take;
    };
    // Reserve previously settled overlaps before FIFO allocation, so a later
    // refund cannot move the Sales return to a different receipt on refresh.
    for (const slot of matches) allocate(slot, slot.overlap);
    for (const slot of matches) allocate(slot, slot.capacity);
  }
  return state;
}

function refundRestockPlan(order, itemIndex, quantity, salesByItem, currentLines = []) {
  const settled = [...(order.refunds || []).filter(r => r.source !== 'sales').flatMap(r => r.items || []), ...currentLines]
    .filter(row => row.orderItemIndex === itemIndex)
    .reduce((sum, row) => sum + qty(row.salesReturnedQuantity), 0);
  const salesReturnedQuantity = Math.min(qty(quantity), Math.max(0, qty(salesByItem[itemIndex]) - settled));
  return { salesReturnedQuantity, restockQuantity: qty(quantity) - salesReturnedQuantity };
}

module.exports = { buildLinkedReturnState, matchingLine, refundRestockPlan, id };
