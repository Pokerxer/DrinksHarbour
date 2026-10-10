import {
  cashRefunded,
  isVoided,
  netSales,
  returnDeduction,
  roundingAmount,
  taxCollected,
  tipAmount,
  totalDiscount,
  type NetSalesOrder,
} from './report-totals';

/**
 * Summary figures for the orders list.
 *
 * Everything here is the **commercial** basis — what the goods sold for. Tips and
 * cash rounding are reported separately, because they are not product income.
 *
 * The page previously summed `total` for "Gross Sales" and counted only cash for
 * "Refunds", which meant the three cards side by side did not add up: the gross
 * figure included gratuities the refund figure ignored, and goods restocked
 * through Sales were returned as sales. The invariant pinned by the tests is
 *
 *     grossSales − returns === netRevenue
 *
 * for every input.
 */
export interface OrdersSummary {
  /** Live (non-voided) receipts in scope. */
  count: number;
  voided: number;
  /** Commercial value of the goods sold, before returns. Excludes tips. */
  grossSales: number;
  /** Value removed from sales by returns and refunds, whether or not cash moved. */
  returns: number;
  /** The subset of `returns` that was actually paid back in cash. */
  cashRefunded: number;
  /** Goods returned through Sales, which cost nothing in cash. */
  salesReturnValue: number;
  /** Commercial sales after returns. */
  netRevenue: number;
  avgOrder: number;
  tips: number;
  rounding: number;
  tax: number;
  discounts: number;
}

export function summariseOrders(orders: readonly NetSalesOrder[]): OrdersSummary {
  let count = 0;
  let voided = 0;
  let netRevenue = 0;
  let returns = 0;
  let cashRefundedTotal = 0;
  let salesReturnValue = 0;
  let tips = 0;
  let rounding = 0;
  let tax = 0;
  let discounts = 0;

  for (const order of orders) {
    if (isVoided(order)) {
      voided += 1;
      continue;
    }
    count += 1;
    const net = netSales(order);
    const returned = returnDeduction(order);
    netRevenue += net;
    returns += returned;
    // A cash refund can never exceed the value returned. Legacy records can
    // disagree — a receipt refunded in full and then adjusted — and letting
    // that through would put the cash figure above the sales it came out of.
    cashRefundedTotal += Math.min(cashRefunded(order), returned);
    salesReturnValue += Math.max(0, (order.salesReturnValue ?? 0));
    tips += tipAmount(order);
    rounding += roundingAmount(order);
    tax += taxCollected(order);
    discounts += totalDiscount(order);
  }

  return {
    count,
    voided,
    // Derived from the two figures that must reconcile, rather than summed
    // separately from `total` — which is how the cards stopped adding up.
    grossSales: netRevenue + returns,
    returns,
    cashRefunded: cashRefundedTotal,
    salesReturnValue,
    netRevenue,
    avgOrder: count > 0 ? netRevenue / count : 0,
    tips,
    rounding,
    tax,
    discounts,
  };
}

export type OrderStatus = 'paid' | 'part-returned' | 'returned' | 'voided';

/**
 * How a receipt stands.
 *
 * A return is judged on the **commercial** figures — the same basis the amounts
 * are displayed on. The old test compared `returnDeduction` against `total`,
 * which includes gratuities and cash rounding, so the two could never be equal
 * and a fully returned receipt that carried a tip was labelled "Part. Returned".
 */
export function orderStatus(order: NetSalesOrder): OrderStatus {
  if (isVoided(order)) return 'voided';
  const returned = returnDeduction(order);
  if (returned <= 0) return 'paid';
  // A return worth at least the goods sold has taken everything off the sale.
  if (returned + 0.005 >= netSales(order) + returned) return 'returned';
  return 'part-returned';
}
