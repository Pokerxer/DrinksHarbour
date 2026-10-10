const { id, matchingLine } = require('./linkedReturns.helpers');
const { settled } = require('./posSessionTotals.service');
const { known } = require('./tenantProductInsights.rules');
const dateKnown = (value) => Number.isFinite(new Date(value || NaN).getTime());
// Coverage, not a second sales total: every fulfilled unit needs a dated source.
function uncertainProducts(sales, receipts) {
  const result = new Set();
  for (const so of sales) {
    if (
      so.docType !== 'order' ||
      !['fulfilled', 'partially_fulfilled'].includes(so.orderStatus) ||
      so.paymentStatus !== 'paid'
    )
      continue;
    const linked = receipts.filter(
      (r) =>
        id(r.tenant) === id(so.tenant) &&
        [id(so._id), id(so.convertedFrom)].includes(id(r.linkedSalesOrder)) &&
        settled(r),
    );
    const refs = new Set(linked.map((r) => r.receiptNumber).filter(Boolean));
    for (const line of so.items || []) {
      if (!line.subproduct || (line.lineType && line.lineType !== 'product'))
        continue;
      let dated = 0;
      for (const receipt of linked) {
        if (!dateKnown(receipt.paidAt || receipt.createdAt)) continue;
        for (const item of receipt.items || [])
          if (
            id(matchingLine(so, item)?._id) === id(line._id) &&
            known(item.quantity)
          )
            dated += item.quantity;
      }
      for (const f of so.fulfillments || []) {
        if (
          !dateKnown(f.at) ||
          (f.status && f.status !== 'posted') ||
          (f.ref && refs.has(f.ref))
        )
          continue;
        for (const item of f.items || [])
          if (String(item.lineId) === id(line._id) && known(item.qty))
            dated += item.qty;
      }
      if (known(line.fulfilledQty) && line.fulfilledQty > dated)
        result.add(id(line.subproduct));
    }
  }
  return result;
}
module.exports = { uncertainProducts };
