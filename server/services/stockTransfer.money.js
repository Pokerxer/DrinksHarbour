// services/stockTransfer.money.js
//
// The transfer-as-purchase money model, in one pure module. The destination
// warehouse buys each line from the source at costPrice less discountRate%,
// plus taxRate%, plus its weight-share of the header deliveryCharge. What the
// destination lot is written at is effectiveUnitCost; what the document shows
// as payable is total (= Σ lineTotal). Kobo drift between the two is accepted;
// total is authoritative.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {Array<{quantity:number, costPrice:number, discountRate?:number, taxRate?:number}>} items
 * @param {number} deliveryCharge
 */
function computeTransferMoney(items = [], deliveryCharge = 0) {
  const charge = round2(deliveryCharge);

  const rawNets = items.map((it) =>
    round2((Number(it.costPrice) || 0) * (Number(it.quantity) || 0) *
      (1 - (Number(it.discountRate) || 0) / 100))
  );
  const netSum = rawNets.reduce((s, n) => s + n, 0);

  let subtotal = 0;
  let discountAmount = 0;
  let taxAmount = 0;

  const lines = items.map((it, i) => {
    const qty = Number(it.quantity) || 0;
    const gross = round2((Number(it.costPrice) || 0) * qty);
    const net = rawNets[i];
    const tax = round2(net * ((Number(it.taxRate) || 0) / 100));
    const share = netSum > 0 ? round2((net / netSum) * charge) : 0;
    subtotal += gross;
    discountAmount += gross - net;
    taxAmount += tax;
    return {
      net,
      tax,
      chargeShare: share,
      effectiveUnitCost: qty > 0 ? round2((net + tax + share) / qty) : 0,
      lineTotal: round2(net + tax + share),
    };
  });

  return {
    lines,
    subtotal: round2(subtotal),
    discountAmount: round2(discountAmount),
    taxAmount: round2(taxAmount),
    total: round2(lines.reduce((s, l) => s + l.lineTotal, 0)),
  };
}

module.exports = { computeTransferMoney, round2 };
