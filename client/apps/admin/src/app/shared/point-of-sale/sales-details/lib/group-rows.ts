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

    const entry = map.get(key);
    if (entry) {
      entry.row.qty += r.qty;
      entry.row.gross += r.gross;
      entry.row.discount += r.discount;
      entry.row.revenue += r.subtotal;
      entry.row.profit += r.profit;
      entry.row.lineCount += 1;
      entry.orderIds.add(r.orderId);
    } else {
      map.set(key, {
        row: {
          key,
          qty: r.qty,
          gross: r.gross,
          discount: r.discount,
          revenue: r.subtotal,
          profit: r.profit,
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