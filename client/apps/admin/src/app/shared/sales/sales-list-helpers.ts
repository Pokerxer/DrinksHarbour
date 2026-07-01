import type { SalesOrder } from '@/services/salesOrder.service';
import type { FilterValue, FilterConfig } from '../advanced-search/advanced-search-types';
import toast from 'react-hot-toast';

export type DocTypeFilter = 'all' | 'quotation' | 'order';

export type GroupByKey =
  | 'none'
  | 'salesperson'
  | 'customer'
  | 'orderDate'
  | 'paymentMethod'
  | 'defaultSalesPriceInclude';

export type GroupBySubOption =
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day';

export type DatePreset_ =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'week'
  | 'month'
  | 'last-month'
  | 'quarter'
  | 'last-quarter'
  | 'year'
  | 'last-year';

export type ActiveFilterType = 'docType' | 'date' | 'my' | 'custom';

export interface ActiveFilter {
  id: string;
  label: string;
  type: ActiveFilterType;
  value?: string;
  filterValue?: FilterValue;
}

export type DatePreset = DatePreset_;

export interface OptionalCol {
  key: string;
  label: string;
  visible: boolean;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: ActiveFilter[];
  groupBy: GroupByKey;
  groupBySubOption?: GroupBySubOption;
  search: string;
}

export const PAGE_SIZE = 80;
export const FAVORITES_KEY = 'dh.sales.favorites';
export const CUSTOM_GROUP_KEY = 'dh.sales.custom-groups';

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'last-year', label: 'Last Year' },
];

export const GROUP_OPTIONS: { key: GroupByKey; label: string }[] = [
  { key: 'salesperson', label: 'Salesperson' },
  { key: 'customer', label: 'Customer' },
  { key: 'orderDate', label: 'Order Date' },
  { key: 'paymentMethod', label: 'Payment Method' },
  { key: 'defaultSalesPriceInclude', label: 'Default Sales Price Include' },
];

export function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function warehouseName(so: SalesOrder): string {
  if (!so.warehouseId) return '—';
  if (typeof so.warehouseId === 'object' && so.warehouseId !== null) {
    return (so.warehouseId as { _id: string; name: string }).name;
  }
  return '—';
}

export function salespersonName(so: SalesOrder): string {
  if (typeof so.salesperson === 'object' && so.salesperson) {
    return so.salesperson.name;
  }
  return 'None';
}

export function statusText(so: SalesOrder): string {
  if (so.docType === 'order') return 'Sales Order';
  switch (so.quoteStatus) {
    case 'converted':
      return 'Converted';
    case 'accepted':
      return 'Quotation Sent';
    case 'rejected':
      return 'Cancelled';
    default:
      return 'Quotation';
  }
}

export function dateRange(preset: string): [Date, Date] | null {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (preset as DatePreset) {
    case 'today':
      return [start, now];
    case 'yesterday': {
      const s = new Date(start);
      s.setDate(s.getDate() - 1);
      const e = new Date(s);
      e.setHours(23, 59, 59, 999);
      return [s, e];
    }
    case 'last7': {
      const s = new Date(start);
      s.setDate(s.getDate() - 6);
      return [s, now];
    }
    case 'week': {
      const d = new Date(start);
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      return [d, now];
    }
    case 'month':
      return [new Date(now.getFullYear(), now.getMonth(), 1), now];
    case 'last-month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return [s, e];
    }
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return [new Date(now.getFullYear(), q, 1), now];
    }
    case 'last-quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const startQ = ((q - 1 + 4) % 4);
      const yearOff = q === 0 ? -1 : 0;
      const sy = now.getFullYear() + yearOff;
      const s = new Date(sy, startQ * 3, 1);
      const e = new Date(sy, startQ * 3 + 3, 0, 23, 59, 59, 999);
      return [s, e];
    }
    case 'year':
      return [new Date(now.getFullYear(), 0, 1), now];
    case 'last-year': {
      const y = now.getFullYear() - 1;
      return [new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59, 999)];
    }
    default:
      return null;
  }
}

export function csvEscape(value: string | number | undefined): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function activeFilterToFilterValue(
  af: ActiveFilter,
): FilterValue | null {
  if (af.type === 'docType') {
    return { fieldId: 'docType', operator: 'equals', value: af.value ?? '', label: af.label };
  }
  if (af.type === 'date') {
    return { fieldId: 'createdAt', operator: 'between', value: [af.value ?? '', ''], label: af.label };
  }
  if (af.type === 'my') {
    return { fieldId: 'salesperson', operator: 'equals', value: '__me__', label: af.label };
  }
  if (af.type === 'custom' && af.filterValue) {
    return af.filterValue;
  }
  return null;
}

export function filterValueToActiveFilter(
  fv: FilterValue,
  configs: FilterConfig[],
): ActiveFilter {
  const config = configs.find((c) => c.id === fv.fieldId);
  const label = config?.label ?? fv.label;

  if (fv.fieldId === 'docType') {
    return { id: 'docType', label, type: 'docType', value: String(fv.value) };
  }
  if (fv.fieldId === 'createdAt') {
    const v = Array.isArray(fv.value) ? String((fv.value as [string, string])[0] ?? '') : String(fv.value);
    return { id: `date-${v || Date.now()}`, label, type: 'date', value: v, filterValue: fv };
  }
  if (fv.fieldId === 'salesperson' && fv.value === '__me__') {
    return { id: 'my', label: 'My Quotations', type: 'my', filterValue: fv };
  }

  return {
    id: fv.fieldId,
    label,
    type: 'custom',
    value: String(fv.value),
    filterValue: fv,
  };
}

export function downloadCsv(rows: SalesOrder[], filename: string) {
  if (rows.length === 0) {
    toast.error('Nothing to export');
    return;
  }
  const headers = [
    'Number',
    'Creation Date',
    'Customer',
    'Salesperson',
    'Untaxed Amount',
    'Taxes',
    'Total',
    'Currency',
    'Warehouse',
    'Status',
  ];
  const body = rows.map((o) =>
    [
      o.soNumber,
      fmtDate(o.createdAt),
      o.customerSnapshot?.name ?? '',
      salespersonName(o),
      (o.total ?? 0) - (o.taxTotal ?? 0),
      o.taxTotal ?? 0,
      o.total ?? 0,
      o.currency ?? '',
      warehouseName(o),
      statusText(o),
    ]
      .map(csvEscape)
      .join(',')
  );
  const csv = [headers.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(
    `Exported ${rows.length} record${rows.length === 1 ? '' : 's'}`
  );
}
