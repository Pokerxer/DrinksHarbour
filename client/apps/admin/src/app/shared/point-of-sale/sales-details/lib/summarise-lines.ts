import type { LinesSummary, LineRow } from '../types';

/**
 * Summary figures for the sales-details strip.
 *
 * Every figure is the **commercial** basis — what the goods were worth. Tips and
 * cash rounding never reach a line, so they cannot inflate anything here.
 *
 * The strip used to show Gross with the sub-label "− discount" above a Net
 * Revenue labelled "after discounts", but the server also deducts returns from
 * each line's net sales. The real gap between the two cards was discount *plus*
 * returns, and nothing reported the returns, so the row could not be made to
 * add up. The identity pinned by the tests is
 *
 *     gross − returns === netRevenue
 *
 * A discount is a **disclosure** (a percentage of gross), not a step in that
 * chain: the net figure has it taken out already, and subtracting it again
 * would double-count.
 */
export function summariseLines(rows: readonly LineRow[]): LinesSummary {
  let gross = 0;
  let returns = 0;
  let revenue = 0;
  let discount = 0;
  let costedRevenue = 0;
  let uncostedRevenue = 0;
  let profit = 0;
  let items = 0;
  const orders = new Set<string>();

  for (const r of rows) {
    orders.add(r.orderId);
    // `grossShare` is the server's commercial allocation. Legacy lines that
    // predate the field fall back to the pre-discount line value.
    gross += r.grossShare ?? r.gross;
    returns += r.returnedValue ?? 0;
    revenue += r.subtotal;
    discount += r.discount;
    items += r.qty;
    if (r.hasCost) {
      costedRevenue += r.subtotal;
      profit += r.profit;
    } else {
      uncostedRevenue += r.subtotal;
    }
  }

  return {
    lines: rows.length,
    orders: orders.size,
    gross,
    returns,
    revenue,
    discount,
    costedRevenue,
    uncostedRevenue,
    profit,
    margin: costedRevenue > 0 ? (profit / costedRevenue) * 100 : 0,
    items,
    avgOrder: orders.size > 0 ? revenue / orders.size : 0,
  };
}
