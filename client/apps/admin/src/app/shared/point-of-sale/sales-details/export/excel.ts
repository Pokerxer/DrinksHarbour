import * as XLSX from 'xlsx';
import { LINE_EXPORT_COLS, GROUP_EXPORT_COLS, METHOD_LABEL } from '../constants';
import { fmtDateTime } from '../helpers';
import type {
  LineRow,
  GroupRow,
  LineExportCol,
  GroupExportCol,
} from '../types';

function getLineCellExcel(r: LineRow, key: LineExportCol): string | number {
  switch (key) {
    case 'date':
      return fmtDateTime(r.date);
    case 'order':
      return r.orderNumber;
    case 'receipt':
      return r.receiptNumber;
    case 'cashier':
      return r.cashier;
    case 'product':
      return r.product;
    case 'variant':
      return r.variant;
    case 'category':
      return r.category;
    case 'subcategory':
      return r.subcategory;
    case 'brand':
      return r.brand;
    case 'qty':
      return r.qty;
    case 'unitPrice':
      return r.unitPrice;
    case 'gross':
      // The server's commercial allocation, so gross − returns === net in the
      // sheet exactly as it does on screen.
      return r.grossShare ?? r.gross;
    case 'returns':
      return r.returnedValue ?? 0;
    case 'discount':
      return r.discount;
    case 'net':
      return r.subtotal;
    case 'cost':
      return r.costPrice;
    case 'profit':
      return r.profit;
    case 'margin':
      // "n/a" rather than 0: a line with no cost basis has no margin to report,
      // and 0 in a spreadsheet column reads as a real measurement.
      if (!r.hasCost || r.subtotal <= 0) return 'n/a';
      return +((r.profit / r.subtotal) * 100).toFixed(1);
    case 'payment': {
      if (!r.splitPayment || r.paymentShares.length === 0)
        return METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod;
      // Name every leg of a split receipt so the export can be reconciled
      // against the till.
      return r.paymentShares
        .map((s) => `${METHOD_LABEL[s.method] ?? s.method} ${s.amount.toFixed(2)}`)
        .join(' + ');
    }
    case 'voided':
      return r.isVoided ? 'Yes' : 'No';
    default:
      return '';
  }
}

function getGroupCellExcel(r: GroupRow, key: GroupExportCol): string | number {
  // Measured on the group's costed revenue; absent, not zero, when nothing in
  // the group carries a cost basis.
  const mg = r.costedRevenue > 0 ? +((r.profit / r.costedRevenue) * 100).toFixed(1) : 'n/a';
  switch (key) {
    case 'key':
      return r.key;
    case 'qty':
      return r.qty;
    case 'gross':
      return r.gross;
    case 'returns':
      return r.returns ?? 0;
    case 'discount':
      return r.discount;
    case 'revenue':
      return r.revenue;
    case 'profit':
      return r.profit;
    case 'margin':
      return mg;
    case 'share':
      return +r.share.toFixed(1);
    case 'lineCount':
      return r.lineCount;
    case 'orderCount':
      return r.orderCount;
    default:
      return '';
  }
}

export function exportLineExcel(rows: LineRow[], cols: Set<LineExportCol>) {
  const defs = LINE_EXPORT_COLS.filter((c) => cols.has(c.key));
  const headers = defs.map((c) => c.label);
  const data = rows.map((r) => defs.map((c) => getLineCellExcel(r, c.key)));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Details');
  XLSX.writeFile(
    wb,
    `sales-details-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

export function exportGroupedExcel(
  rows: GroupRow[],
  groupLabel: string,
  cols: Set<GroupExportCol>
) {
  const defs = GROUP_EXPORT_COLS.filter((c) => cols.has(c.key));
  const headers = defs.map((c) => (c.key === 'key' ? groupLabel : c.label));
  const data = rows.map((r) => defs.map((c) => getGroupCellExcel(r, c.key)));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Grouped');
  XLSX.writeFile(
    wb,
    `sales-grouped-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}