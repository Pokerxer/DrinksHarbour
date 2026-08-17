import type { SalesOrder } from '@/services/salesOrder.service';
import type {
  FilterValue,
  FilterConfig,
} from '../advanced-search/advanced-search-types';
import { FILTER_CONFIGS } from '../advanced-search/filter-config-data';
import { docStatusBadge, paymentBadge } from './sales-list-status';
import toast from 'react-hot-toast';

export type DocTypeFilter = 'all' | 'quotation' | 'order';

export type GroupByKey =
  | 'none'
  | 'salesperson'
  | 'customer'
  | 'orderDate'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'orderStatus';

export type GroupBySubOption = 'year' | 'quarter' | 'month' | 'week' | 'day';

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

export type { OptionalCol } from './sales-list-columns';

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
  { key: 'paymentStatus', label: 'Payment Status' },
  { key: 'orderStatus', label: 'Order Status' },
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

// `salesperson` is a String on the SalesOrder schema — the user's name, written
// from req.user.name at create time and never populated into an object. The
// client type used to declare `{ _id, name } | null`, so this returned 'None'
// for every order ever written.
export function salespersonName(so: SalesOrder): string {
  return so.salesperson?.trim() || 'None';
}

export function statusText(so: SalesOrder): string {
  return docStatusBadge(so).label;
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
      const startQ = (q - 1 + 4) % 4;
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
  af: ActiveFilter
): FilterValue | null {
  if (af.type === 'docType') {
    return {
      fieldId: 'docType',
      operator: 'equals',
      value: af.value ?? '',
      label: af.label,
    };
  }
  if (af.type === 'date') {
    return {
      fieldId: 'createdAt',
      operator: 'between',
      value: [af.value ?? '', ''],
      label: af.label,
    };
  }
  if (af.type === 'my') {
    return {
      fieldId: 'salesperson',
      operator: 'equals',
      value: '__me__',
      label: af.label,
    };
  }
  if (af.type === 'custom' && af.filterValue) {
    return af.filterValue;
  }
  return null;
}

export function filterValueToActiveFilter(
  fv: FilterValue,
  configs: FilterConfig[]
): ActiveFilter {
  const config = configs.find((c) => c.id === fv.fieldId);
  const label = config?.label ?? fv.label;

  if (fv.fieldId === 'docType') {
    return { id: 'docType', label, type: 'docType', value: String(fv.value) };
  }
  if (fv.fieldId === 'createdAt') {
    const v = Array.isArray(fv.value)
      ? String((fv.value as [string, string])[0] ?? '')
      : String(fv.value);
    return {
      id: `date-${v || Date.now()}`,
      label,
      type: 'date',
      value: v,
      filterValue: fv,
    };
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

// ─── The params the list sends to the server ─────────────────────────────────

export interface ListParamsInput {
  activeFilters: ActiveFilter[];
  search: string;
  groupBy: GroupByKey;
  groupBySubOption?: GroupBySubOption;
  /** The salesperson field holds a NAME, so "My Quotations" must filter by name. */
  currentUserName: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  /** Overrides PAGE_SIZE — the export walks the result set in bigger pages. */
  pageSize?: number;
}

export type ListParams = Record<string, string | number | undefined>;

// The server keys a filter off `field`, the SalesOrder document path, and drops
// anything else. The UI's own identity for a filter is `fieldId` (the config
// id, e.g. 'payment_status'), which is NOT a document path — sending only that
// is why every advanced filter was silently ignored. Favourites saved to
// localStorage before `field` was carried are resolved here rather than dying.
/** One filter as it goes over the wire: a document path, not a UI id. */
export interface WireFilter {
  field: string;
  operator: FilterValue['operator'];
  value: FilterValue['value'];
}

function resolveFilterField(fv: FilterValue): string | null {
  if (fv.field) return fv.field;
  return FILTER_CONFIGS.find((c) => c.id === fv.fieldId)?.field ?? null;
}

export function buildListParams(input: ListParamsInput): ListParams {
  const {
    activeFilters,
    search,
    groupBy,
    groupBySubOption,
    currentUserName,
    dateFrom,
    dateTo,
    page,
    pageSize,
  } = input;

  const params: ListParams = {};
  const docFilter = activeFilters.find((f) => f.type === 'docType');
  const dateFilter = activeFilters.find((f) => f.type === 'date');
  const myFilter = activeFilters.find((f) => f.type === 'my');

  // Grouping counts over the whole result set, so it is never paginated.
  if (groupBy === 'none') {
    params.page = page;
    params.limit = pageSize ?? PAGE_SIZE;
  }
  if (search) params.search = search;
  if (docFilter?.value) params.docType = docFilter.value;
  // An empty name would send `salesperson=` and match nothing while looking
  // like a filter that ran.
  if (myFilter && currentUserName.trim())
    params.salesperson = currentUserName.trim();

  if (dateFilter?.value) {
    const range = dateRange(dateFilter.value);
    if (range) {
      params.dateFrom = range[0].toISOString();
      params.dateTo = range[1].toISOString();
    }
  }
  // An explicit range wins over a preset.
  if (dateFrom)
    params.dateFrom = new Date(`${dateFrom}T00:00:00`).toISOString();
  if (dateTo) params.dateTo = new Date(`${dateTo}T23:59:59`).toISOString();

  const custom = activeFilters
    .filter((f) => f.type === 'custom' && f.filterValue)
    .map((f): WireFilter | null => {
      const fv = f.filterValue as FilterValue;
      const field = resolveFilterField(fv);
      // No path means the server would drop it anyway; not sending it keeps
      // the wire honest about what was actually asked for.
      if (!field) return null;
      return { field, operator: fv.operator, value: fv.value };
    })
    .filter((f): f is WireFilter => f !== null);
  if (custom.length > 0) params.filters = JSON.stringify(custom);

  if (groupBy !== 'none') {
    params.groupBy = groupBy;
    if (groupBySubOption) params.groupBySubOption = groupBySubOption;
  }

  return params;
}

// ─── Fetching a whole result set ─────────────────────────────────────────────

/**
 * Walk a paginated endpoint to the end. `complete` is false when the walk
 * stopped early — a truncated export that claimed to be whole would be a wrong
 * answer wearing the shape of a right one.
 */
export async function collectAllPages<T>(
  fetchPage: (page: number) => Promise<{ rows: T[]; total: number }>,
  { pageSize, maxPages = 50 }: { pageSize: number; maxPages?: number }
): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  let total = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetchPage(page);
    total = res.total;
    rows.push(...res.rows);
    if (rows.length >= total) return { rows, complete: true };
    // A short page means the server gave all it will give — a lower server-side
    // cap, or rows deleted mid-walk. Stop rather than spin.
    if (res.rows.length < pageSize) return { rows, complete: false };
  }

  return { rows, complete: rows.length >= total };
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export interface CsvMatrix {
  headers: string[];
  rows: (string | number)[][];
}

/**
 * The cells that become the file. Split out from downloadCsv so the money and
 * status columns can be asserted on without touching the DOM.
 */
export function csvMatrix(orders: SalesOrder[]): CsvMatrix {
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
    'Payment Status',
    'Amount Paid',
    'Outstanding',
  ];
  const rows = orders.map((o) => {
    const pay = paymentBadge(o);
    return [
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
      pay.label,
      pay.paid,
      pay.outstanding,
    ];
  });
  return { headers, rows };
}

export function downloadCsv(rows: SalesOrder[], filename: string) {
  if (rows.length === 0) {
    toast.error('Nothing to export');
    return;
  }
  const { headers, rows: body } = csvMatrix(rows);
  const csv = [
    headers.join(','),
    ...body.map((r) => r.map(csvEscape).join(',')),
  ].join('\n');
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
