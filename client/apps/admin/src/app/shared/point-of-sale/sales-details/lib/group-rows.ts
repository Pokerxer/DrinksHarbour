import { METHOD_LABEL } from '../constants';
import { fmtDate } from '../helpers';
import type { GroupRow, GroupByKey, GroupSortField, LineRow } from '../types';

export function groupRows(
  rows: LineRow[],
  groupBy: GroupByKey,
  sortField: GroupSortField,
  sortDir: 'asc' | 'desc'
): GroupRow[] {
  const totalRev = rows.reduce((s, r) => s + r.subtotal, 0);
  const map = new Map<string, { row: GroupRow; orderIds: Set<string> }>();

  for (const r of rows) {
    const key =
      groupBy === 'product'
        ? r.product + (r.variant ? ` (${r.variant})` : '')
        : groupBy === 'variant'
          ? r.variant || '(no variant)'
          : groupBy === 'cashier'
            ? r.cashier
            : groupBy === 'payment_method'
              ? (METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod)
              : groupBy === 'warehouse'
                ? r.warehouse || 'No warehouse'
                : fmtDate(r.date);

    // A group reports the same fields the strip does, so a row of the grouped
    // table can be reconciled against the summary in the same way a line can:
    // gross − returns === revenue, and margin is measured on costed revenue
    // only. A line with no cost basis is disclosed, never folded in as 0% margin.
    const entry = map.get(key);
    if (entry) {
      entry.row.qty += r.qty;
      entry.row.gross += r.grossShare ?? r.gross;
      entry.row.returns += r.returnedValue ?? 0;
      entry.row.discount += r.discount;
      entry.row.revenue += r.subtotal;
      if (r.hasCost) {
        entry.row.costedRevenue += r.subtotal;
        entry.row.profit += r.profit;
      } else {
        entry.row.uncostedRevenue += r.subtotal;
      }
      entry.row.lineCount += 1;
      entry.orderIds.add(r.orderId);
    } else {
      map.set(key, {
        row: {
          key,
          qty: r.qty,
          gross: r.grossShare ?? r.gross,
          returns: r.returnedValue ?? 0,
          discount: r.discount,
          revenue: r.subtotal,
          costedRevenue: r.hasCost ? r.subtotal : 0,
          uncostedRevenue: r.hasCost ? 0 : r.subtotal,
          profit: r.hasCost ? r.profit : 0,
          margin: 0,
          lineCount: 1,
          orderCount: 0,
          share: 0,
        },
        orderIds: new Set([r.orderId]),
      });
    }
  }

  return Array.from(map.values())
    .map(({ row, orderIds }) => ({
      ...row,
      orderCount: orderIds.size,
      margin: row.costedRevenue > 0 ? (row.profit / row.costedRevenue) * 100 : 0,
      share: totalRev > 0 ? (row.revenue / totalRev) * 100 : 0,
    }))
    .sort((a, b) => {
      const av = a[sortField] as number | string;
      const bv = b[sortField] as number | string;
      if (typeof av === 'number' && typeof bv === 'number')
        return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
}
