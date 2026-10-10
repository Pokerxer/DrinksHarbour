import { LINE_EXPORT_COLS, GROUP_EXPORT_COLS, METHOD_LABEL } from '../constants';
import { fmtDateTime } from '../helpers';
import type {
  LineRow,
  GroupRow,
  LineExportCol,
  GroupExportCol,
} from '../types';

export function getLineCell(
  r: LineRow,
  key: LineExportCol,
  fmt: 'csv' | 'pdf'
): string {
  const q = (s: string) => (fmt === 'csv' ? `"${s.replace(/"/g, '""')}"` : s);
  switch (key) {
    case 'date':
      return fmtDateTime(r.date);
    case 'order':
      return fmt === 'pdf'
        ? r.isVoided
          ? `${r.orderNumber} [VOID]`
          : r.orderNumber
        : r.orderNumber;
    case 'receipt':
      return r.receiptNumber;
    case 'cashier':
      return q(r.cashier);
    case 'product':
      return q(r.product);
    case 'variant':
      return q(r.variant || (fmt === 'pdf' ? '—' : ''));
    case 'category':
      return q(r.category || (fmt === 'pdf' ? '—' : ''));
    case 'subcategory':
      return q(r.subcategory || (fmt === 'pdf' ? '—' : ''));
    case 'brand':
      return q(r.brand || (fmt === 'pdf' ? '—' : ''));
    case 'qty':
      return r.qty.toString();
    case 'unitPrice':
      return r.unitPrice.toFixed(2);
    case 'gross':
      // The server's commercial allocation, so gross − returns === net in the
      // export exactly as it does on screen. The pre-discount line value does
      // not include tax and does not reconcile.
      return (r.grossShare ?? r.gross).toFixed(2);
    case 'returns':
      return (r.returnedValue ?? 0).toFixed(2);
    case 'discount':
      return fmt === 'pdf'
        ? r.discount > 0
          ? r.discount.toFixed(2)
          : '—'
        : r.discount.toFixed(2);
    case 'net':
      return r.subtotal.toFixed(2);
    case 'cost':
      return fmt === 'pdf'
        ? r.costPrice > 0
          ? r.costPrice.toFixed(2)
          : '—'
        : r.costPrice.toFixed(2);
    case 'profit':
      return fmt === 'pdf'
        ? r.profit > 0
          ? r.profit.toFixed(2)
          : '—'
        : r.profit.toFixed(2);
    case 'margin': {
      // A line with no cost basis has no margin to report. Emitting "0" reads
      // as a measurement — the tenant sold at a loss — when it is a gap in the
      // data. A real loss is a real negative number and is reported as one.
      if (!r.hasCost || r.subtotal <= 0) return fmt === 'pdf' ? '—' : 'n/a';
      return ((r.profit / r.subtotal) * 100).toFixed(1) + '%';
    }
    case 'payment': {
      const label = METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod;
      if (!r.splitPayment || r.paymentShares.length === 0) return q(label);
      // A split receipt is not one method. Naming only the dominant leg hid the
      // other tender from anyone reconciling the till against this export.
      return q(
        r.paymentShares
          .map((s) => `${METHOD_LABEL[s.method] ?? s.method} ${s.amount.toFixed(2)}`)
          .join(' + ')
      );
    }
    case 'voided':
      return r.isVoided ? 'Yes' : 'No';
    default:
      return '';
  }
}

export function getGroupCell(
  r: GroupRow,
  key: GroupExportCol,
  fmt: 'csv' | 'pdf'
): string {
  // Measured on the group's costed revenue, and absent rather than zero when
  // nothing in the group carries a cost basis.
  const mg = r.costedRevenue > 0 ? ((r.profit / r.costedRevenue) * 100).toFixed(1) : null;
  switch (key) {
    case 'key':
      return fmt === 'csv' ? `"${r.key.replace(/"/g, '""')}"` : r.key;
    case 'qty':
      return r.qty.toLocaleString();
    case 'gross':
      return r.gross.toFixed(2);
    case 'returns':
      return (r.returns ?? 0).toFixed(2);
    case 'discount':
      return fmt === 'pdf' && r.discount === 0 ? '—' : r.discount.toFixed(2);
    case 'revenue':
      return r.revenue.toFixed(2);
    case 'profit':
      return fmt === 'pdf' && r.profit === 0 ? '—' : r.profit.toFixed(2);
    case 'margin':
      return mg ? mg + '%' : fmt === 'pdf' ? '—' : 'n/a';
    case 'share':
      return r.share.toFixed(1) + '%';
    case 'lineCount':
      return r.lineCount.toLocaleString();
    case 'orderCount':
      return r.orderCount.toLocaleString();
    default:
      return '';
  }
}

function triggerCsvDownload(csv: string, name: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLineCsv(rows: LineRow[], cols: Set<LineExportCol>) {
  const defs = LINE_EXPORT_COLS.filter((c) => cols.has(c.key));
  const header = defs.map((c) => c.label).join(',');
  const lines = rows.map((r) =>
    defs.map((c) => getLineCell(r, c.key, 'csv')).join(',')
  );
  triggerCsvDownload([header, ...lines].join('\n'), 'sales-details');
}

export function exportGroupedCsv(
  rows: GroupRow[],
  groupLabel: string,
  cols: Set<GroupExportCol>
) {
  const defs = GROUP_EXPORT_COLS.filter((c) => cols.has(c.key));
  const header = defs
    .map((c) => (c.key === 'key' ? groupLabel : c.label))
    .join(',');
  const lines = rows.map((r) =>
    defs.map((c) => getGroupCell(r, c.key, 'csv')).join(',')
  );
  triggerCsvDownload([header, ...lines].join('\n'), 'sales-grouped');
}