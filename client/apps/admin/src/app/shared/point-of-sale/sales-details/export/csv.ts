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
      return r.gross.toFixed(2);
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
      if (r.profit > 0 && r.subtotal > 0) {
        const mg = ((r.profit / r.subtotal) * 100).toFixed(1);
        return fmt === 'pdf' ? mg + '%' : mg + '%';
      }
      return fmt === 'pdf' ? '—' : '0';
    }
    case 'payment':
      return q(METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod);
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
  const mg =
    r.profit > 0 && r.revenue > 0
      ? ((r.profit / r.revenue) * 100).toFixed(1)
      : null;
  switch (key) {
    case 'key':
      return fmt === 'csv' ? `"${r.key.replace(/"/g, '""')}"` : r.key;
    case 'qty':
      return r.qty.toLocaleString();
    case 'gross':
      return r.gross.toFixed(2);
    case 'discount':
      return fmt === 'pdf' && r.discount === 0 ? '—' : r.discount.toFixed(2);
    case 'revenue':
      return r.revenue.toFixed(2);
    case 'profit':
      return fmt === 'pdf' && r.profit === 0 ? '—' : r.profit.toFixed(2);
    case 'margin':
      return mg ? mg + '%' : fmt === 'pdf' ? '—' : '0';
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