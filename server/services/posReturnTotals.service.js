const money = n => Math.round(n * 100) / 100;
const number = n => Math.max(0, Number(n) || 0);

// What the customer actually paid: `totalAmount` is the payable tender total
// (goods + tip ± cash rounding), so it is the cash basis, not the sales basis.
const tenderTotal = order => number(order.totalAmount);

// Sales are what the goods were worth. A tip is money for the staff and a cash
// rounding delta is a tender artefact — neither is product income, and neither
// may inflate commercial sales (see the tipAmount/roundingAmount notes on
// models/Order.js). Returns deduct from this figure, never from the tip.
function commercialGross(order) {
  return Math.max(0, tenderTotal(order) - number(order.tipAmount) - number(order.roundingAmount));
}

// Commercial sales after returns. Tender cash remains a separate measure.
function orderReturnTotals(order) {
  const tender = tenderTotal(order);
  const gross = commercialGross(order);
  const items = order.items || [];
  // Pro-rate the commercial total over lines by their post-discount value plus
  // tax, so a return on a taxed receipt is valued on the same basis it was sold.
  const weights = items.map(item => number(item.itemSubtotal ?? number(item.priceAtPurchase) * number(item.quantity) - number(item.discountAmount)) + number(item.taxAmount));
  const base = weights.reduce((sum, n) => sum + n, 0);
  const salesQty = {}, posQty = {}, overlapQty = {};
  let totalRefunds = 0, cashOverlap = 0;
  for (const refund of order.refunds || []) {
    if (refund.source !== 'sales') totalRefunds += number(refund.totalRefunded);
    for (const line of refund.items || []) {
      const index = line.orderItemIndex;
      if (refund.source === 'sales') salesQty[index] = (salesQty[index] || 0) + number(line.quantity);
      else {
        posQty[index] = (posQty[index] || 0) + number(line.quantity);
        const overlap = Math.min(number(line.quantity), number(line.salesReturnedQuantity));
        overlapQty[index] = (overlapQty[index] || 0) + overlap;
        cashOverlap += line.quantity > 0 ? number(line.amount) * overlap / line.quantity : 0;
      }
    }
  }
  let salesReturnValue = 0, overlapValue = 0, returnedUnits = 0, soldUnits = 0;
  items.forEach((item, index) => {
    const quantity = number(item.quantity);
    const unitValue = quantity > 0 && base > 0 ? gross * weights[index] / base / quantity : 0;
    salesReturnValue += unitValue * Math.min(quantity, salesQty[index] || 0);
    overlapValue += unitValue * Math.min(quantity, salesQty[index] || 0, overlapQty[index] || 0);
    returnedUnits += Math.min(quantity, (salesQty[index] || 0) + Math.max(0, (posQty[index] || 0) - (overlapQty[index] || 0)));
    soldUnits += quantity;
  });
  const deduction = totalRefunds + salesReturnValue - Math.min(cashOverlap, overlapValue);
  // A refund returns goods value. When the cashier refunded more than the goods
  // were worth (tip included in the tendered figure), only the commercial
  // portion is deducted from sales — the rest simply left the till as cash.
  const salesDeduction = Math.min(deduction, gross);
  return {grossRevenue:money(gross),totalRefunds:money(totalRefunds),salesReturnValue:money(salesReturnValue),
    returnDeduction:money(salesDeduction),netSales:order.isVoided ? 0 : money(gross - salesDeduction),
    netCollections:order.isVoided ? 0 : money(tender - totalRefunds),
    totalTips:money(number(order.tipAmount)),totalRounding:money(number(order.roundingAmount)),
    returnStatus:returnedUnits > 0 ? (returnedUnits >= soldUnits ? 'returned' : 'partially_returned') : 'none'};
}
module.exports = {orderReturnTotals, commercialGross};
