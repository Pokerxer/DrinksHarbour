import type {
  ToggleableCol,
  LineExportCol,
  GroupExportCol,
  SelectOption,
} from './types';

export const PAGE_SIZE = 50;
export const GROUP_PAGE_SIZE = 30;

export const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card/POS',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  split: 'Split',
  other: 'Other',
};

export const METHOD_COLOR: Record<string, string> = {
  cash: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  card: 'bg-blue-50 text-blue-700 border border-blue-100',
  bank_transfer: 'bg-violet-50 text-violet-700 border border-violet-100',
  mobile_money: 'bg-amber-50 text-amber-700 border border-amber-100',
  split: 'bg-orange-50 text-orange-700 border border-orange-100',
  other: 'bg-gray-100 text-gray-600 border border-gray-200',
};

export const METHOD_DOT: Record<string, string> = {
  cash: 'bg-emerald-500',
  card: 'bg-blue-500',
  bank_transfer: 'bg-violet-500',
  mobile_money: 'bg-amber-500',
  split: 'bg-orange-500',
  other: 'bg-gray-400',
};

export const TOGGLEABLE_COLS: {
  key: ToggleableCol;
  label: string;
  defaultHidden?: boolean;
}[] = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'cashier', label: 'Cashier' },
  { key: 'variant', label: 'Variant' },
  { key: 'category', label: 'Category', defaultHidden: true },
  { key: 'subcategory', label: 'Subcategory', defaultHidden: true },
  { key: 'brand', label: 'Brand', defaultHidden: true },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'gross', label: 'Gross Rev.' },
  { key: 'discount', label: 'Discount' },
  { key: 'payment', label: 'Payment' },
];

export const LINE_EXPORT_COLS: {
  key: LineExportCol;
  label: string;
  required?: boolean;
  costOnly?: boolean;
  pdfW: number;
  pdfAlign: 'left' | 'right';
}[] = [
  { key: 'date', label: 'Date/Time', required: true, pdfW: 28, pdfAlign: 'left' },
  { key: 'order', label: 'Order #', pdfW: 18, pdfAlign: 'left' },
  { key: 'receipt', label: 'Receipt #', pdfW: 16, pdfAlign: 'left' },
  { key: 'cashier', label: 'Cashier', pdfW: 22, pdfAlign: 'left' },
  { key: 'product', label: 'Product', required: true, pdfW: 34, pdfAlign: 'left' },
  { key: 'variant', label: 'Variant', pdfW: 18, pdfAlign: 'left' },
  { key: 'category', label: 'Category', pdfW: 20, pdfAlign: 'left' },
  { key: 'subcategory', label: 'Subcategory', pdfW: 20, pdfAlign: 'left' },
  { key: 'brand', label: 'Brand', pdfW: 18, pdfAlign: 'left' },
  { key: 'qty', label: 'Qty', required: true, pdfW: 10, pdfAlign: 'right' },
  { key: 'unitPrice', label: 'Unit Price', pdfW: 20, pdfAlign: 'right' },
  { key: 'gross', label: 'Gross Revenue', pdfW: 20, pdfAlign: 'right' },
  { key: 'discount', label: 'Discount', pdfW: 18, pdfAlign: 'right' },
  { key: 'net', label: 'Net Total', required: true, pdfW: 22, pdfAlign: 'right' },
  { key: 'cost', label: 'Cost Price', costOnly: true, pdfW: 18, pdfAlign: 'right' },
  { key: 'profit', label: 'Profit', costOnly: true, pdfW: 18, pdfAlign: 'right' },
  { key: 'margin', label: 'Margin %', costOnly: true, pdfW: 16, pdfAlign: 'right' },
  { key: 'payment', label: 'Payment', pdfW: 20, pdfAlign: 'left' },
  { key: 'voided', label: 'Voided', pdfW: 12, pdfAlign: 'left' },
];

export const GROUP_EXPORT_COLS: {
  key: GroupExportCol;
  label: string;
  required?: boolean;
  costOnly?: boolean;
  pdfW: number;
  pdfAlign: 'left' | 'right';
}[] = [
  { key: 'key', label: 'Group', required: true, pdfW: 50, pdfAlign: 'left' },
  { key: 'qty', label: 'Qty Sold', pdfW: 16, pdfAlign: 'right' },
  { key: 'gross', label: 'Gross Revenue', pdfW: 26, pdfAlign: 'right' },
  { key: 'discount', label: 'Discount', pdfW: 24, pdfAlign: 'right' },
  { key: 'revenue', label: 'Net Revenue', required: true, pdfW: 26, pdfAlign: 'right' },
  { key: 'profit', label: 'Profit', costOnly: true, pdfW: 24, pdfAlign: 'right' },
  { key: 'margin', label: 'Margin %', costOnly: true, pdfW: 18, pdfAlign: 'right' },
  { key: 'share', label: 'Revenue Share %', pdfW: 16, pdfAlign: 'right' },
  { key: 'lineCount', label: 'Line Count', pdfW: 14, pdfAlign: 'right' },
  { key: 'orderCount', label: 'Distinct Orders', pdfW: 14, pdfAlign: 'right' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function offsetDay(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
}
function startOfLastMonth() {
  return new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    .toISOString().slice(0, 10);
}
function endOfLastMonth() {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 0)
    .toISOString().slice(0, 10);
}

export const DATE_PRESETS = [
  { label: 'Today', from: todayStr, to: todayStr, tf: '00:00', tt: '23:59' },
  { label: 'Yesterday', from: () => offsetDay(-1), to: () => offsetDay(-1), tf: '00:00', tt: '23:59' },
  { label: 'Last 7 days', from: () => offsetDay(-6), to: todayStr, tf: '00:00', tt: '23:59' },
  { label: 'This week', from: startOfWeek, to: todayStr, tf: '00:00', tt: '23:59' },
  { label: 'This month', from: startOfMonth, to: todayStr, tf: '00:00', tt: '23:59' },
  { label: 'Last month', from: startOfLastMonth, to: endOfLastMonth, tf: '00:00', tt: '23:59' },
];

export const GROUP_BY_OPTIONS: SelectOption[] = [
  { value: 'product', label: 'By Product' },
  { value: 'variant', label: 'By Variant' },
  { value: 'warehouse', label: 'By Warehouse' },
  { value: 'cashier', label: 'By Cashier' },
  { value: 'payment_method', label: 'By Payment' },
  { value: 'date', label: 'By Date' },
];

export const PAYMENT_OPTIONS: SelectOption[] = Object.entries(METHOD_LABEL).map(
  ([k, v]) => ({ value: k, label: v, dot: METHOD_DOT[k] })
);

export const GROUP_LABEL = {
  product: 'Product / Variant',
  variant: 'Variant',
  cashier: 'Cashier',
  payment_method: 'Payment Method',
  warehouse: 'Warehouse',
  date: 'Date',
} as const;