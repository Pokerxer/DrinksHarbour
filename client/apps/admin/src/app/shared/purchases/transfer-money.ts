// app/shared/purchases/transfer-money.ts
//
// MIRROR OF server/services/stockTransfer.money.js — keep the two textually
// in sync. The destination warehouse buys each line from the source at
// costPrice less discountRate%, plus taxRate%, plus its weight-share of the
// header deliveryCharge. `total` (Σ lineTotal) is authoritative; kobo drift
// against Σ effectiveUnitCost × qty is accepted. The server recomputes every
// figure on save — these numbers are advisory UI.

export interface TransferMoneyInput {
  quantity: number;
  costPrice: number;
  discountRate?: number;
  taxRate?: number;
}

export interface TransferMoneyLine {
  net: number;
  tax: number;
  chargeShare: number;
  effectiveUnitCost: number;
  lineTotal: number;
}

export interface TransferTotals {
  lines: TransferMoneyLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function computeTransferTotals(
  items: TransferMoneyInput[] = [],
  deliveryCharge = 0
): TransferTotals {
  const charge = round2(deliveryCharge);

  const rawNets = items.map((it) =>
    round2(
      (Number(it.costPrice) || 0) *
        (Number(it.quantity) || 0) *
        (1 - (Number(it.discountRate) || 0) / 100)
    )
  );
  const netSum = rawNets.reduce((s, n) => s + n, 0);

  let subtotal = 0;
  let discountAmount = 0;
  let taxAmount = 0;

  const lines = items.map((it, i): TransferMoneyLine => {
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
