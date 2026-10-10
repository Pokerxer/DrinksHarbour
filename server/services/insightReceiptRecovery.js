const { id, matchingLine } = require('./linkedReturns.helpers');
const { settled } = require('./posSessionTotals.service');

// Exact persisted reconciliation references recover read-time associations;
// neither current warehouse settings nor product balances establish a source.
function recoverInsightReceipts(sales, receipts, tenantId) {
  const refs = new Map();
  for (const so of sales) {
    if (id(so.tenant) !== id(tenantId) || so.docType !== 'order' ||
      so.paymentStatus !== 'paid' ||
      !['fulfilled', 'partially_fulfilled'].includes(so.orderStatus)) continue;
    for (const f of so.fulfillments || []) {
      if (!f.ref || !['posted', 'reconciled'].includes(f.status)) continue;
      const candidates = refs.get(f.ref) || new Map();
      candidates.set(id(so), so);
      refs.set(f.ref, candidates);
    }
  }
  return receipts.map(receipt => {
    const candidates = refs.get(receipt.receiptNumber);
    if (receipt.source !== 'pos' || !settled(receipt) || candidates?.size !== 1)
      return receipt;
    const so = [...candidates.values()][0];
    if ((receipt.tenant && id(receipt.tenant) !== id(tenantId)) ||
      (receipt.linkedSalesOrder &&
        ![id(so), id(so.convertedFrom)].includes(id(receipt.linkedSalesOrder))))
      return receipt;
    const items = (receipt.items || []).filter(item => item.subproduct);
    if (!items.length || items.some(item => {
      if (id(item.tenant || receipt.tenant) !== id(tenantId)) return true;
      const line = matchingLine(so, item);
      if (!line || !Number.isFinite(item.quantity) || item.quantity <= 0) return true;
      const represented = (so.fulfillments || [])
        .filter(f => f.ref === receipt.receiptNumber && ['posted', 'reconciled'].includes(f.status))
        .flatMap(f => f.items || [])
        .filter(r => String(r.lineId) === id(line))
        .reduce((n, r) => n + (Number(r.qty) || 0), 0);
      const received = items.filter(other => id(matchingLine(so, other)) === id(line))
        .reduce((n, other) => n + (Number(other.quantity) || 0), 0);
      return represented < received;
    })) return receipt;
    return { ...receipt, tenant: receipt.tenant || so.tenant,
      linkedSalesOrder: receipt.linkedSalesOrder || so._id };
  });
}
module.exports = { recoverInsightReceipts };
