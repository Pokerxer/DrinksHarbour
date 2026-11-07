const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const PERIOD_KEYS = [
  'today',
  '7d',
  '30d',
  'month',
  'quarter',
  'year',
  'custom',
] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export interface PeriodMeta {
  period: PeriodKey;
  label: string;
  comparisonLabel: string;
  rangeStart: string;
  rangeEnd: string;
}

export interface DashboardParams {
  /** Force a fresh server report for an explicit refresh action. */
  refresh?: boolean;
  period?: string;
  from?: string;
  to?: string;
}

/**
 * Serialise dashboard params into a query string. Unknown periods are dropped
 * rather than forwarded — the server also degrades to its default, but there is
 * no reason to send a request we already know is meaningless.
 */
function buildDashboardPeriodQuery(params: DashboardParams): string {
  const { period, from, to } = params;
  if (!period || !PERIOD_KEYS.includes(period as PeriodKey)) return '';

  if (period === 'custom') {
    if (!from || !to) return '';
    return `?period=custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }

  return `?period=${period}`;
}

export function buildDashboardQuery(params: DashboardParams): string {
  const query = buildDashboardPeriodQuery(params);
  return params.refresh ? `${query}${query ? '&' : '?'}refresh=true` : query;
}

/**
 * Strict URL-date check: the analytics API expects `YYYY-MM-DD`. Anything a
 * user hand-typed into `?from=` / `?to=` (empty strings, `banana`, repeated
 * query params that Next hands us as arrays, `2026-03-01T00:00:00Z`) must be
 * rejected here — not forwarded to the API to guess at.
 */
function isValidDashDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Server-side gate run BEFORE `getDashboardData` makes its network call.
 * Garbage params (`?period=banana`, malformed custom ranges) degrade to the
 * server's default period instead of erroring — the URL is left alone so the
 * user sees the default view rendered from the URL they came in on.
 */
export function resolveDashboardParams(params: DashboardParams): DashboardParams {
  const { period, from, to, refresh } = params;

  if (period && PERIOD_KEYS.includes(period as PeriodKey) && period !== 'custom') {
    // from/to only ever apply to the custom period → never forward them.
    return { period, refresh };
  }
  if (
    period === 'custom' &&
    isValidDashDate(from) &&
    isValidDashDate(to) &&
    from <= to
  ) {
    return { period, from, to, refresh };
  }
  // Anything else falls back to the server default window.
  return { refresh };
}

const DEFAULT_META: PeriodMeta = {
  period: 'month',
  label: 'This month',
  comparisonLabel: 'vs last month',
  rangeStart: '',
  rangeEnd: '',
};

/**
 * Per-widget graceful degradation: the API answering 200 but omitting one
 * section (partial analytics outage) must not crash individual widgets —
 * they already handle empty arrays / zeroed stats. Fill any missing section
 * with a safe default so `data.profit.trend` etc. are always present.
 * A hard failure (non-OK response) still throws — that path keeps the
 * dashboard's full-page failure card, which is documented behaviour.
 */
export function normalizeDashboardData(raw: Partial<DashboardData> | null | undefined): DashboardData {
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  const statCards = raw?.statCards ?? ({} as Partial<StatCards>);
  const profit = raw?.profit ?? ({} as Partial<ProfitData>);

  return {
    statCards: {
      period: { orders: num(statCards.period?.orders), revenue: num(statCards.period?.revenue) },
      previous: { orders: num(statCards.previous?.orders), revenue: num(statCards.previous?.revenue) },
      today: { orders: num(statCards.today?.orders), revenue: num(statCards.today?.revenue) },
      yesterday: { orders: num(statCards.yesterday?.orders), revenue: num(statCards.yesterday?.revenue) },
      pendingOrders: num(statCards.pendingOrders),
      lowStockCount: num(statCards.lowStockCount),
      avgOrderValue: num(statCards.avgOrderValue),
      sparkline: arr<SparklineDay>(statCards.sparkline),
    },
    salesReport: arr<MonthlySales>(raw?.salesReport),
    statusBreakdown: (typeof raw?.statusBreakdown === 'object' && raw?.statusBreakdown !== null
      ? raw.statusBreakdown
      : {}) as Record<string, number>,
    paymentBreakdown: arr<PaymentBreakdownItem>(raw?.paymentBreakdown),
    // productSlug is the only per-item normalisation: the server added it
    // additively for product deep links, so an older payload omits it and the
    // widget must see '' rather than an undefined key.
    topProducts: arr<Partial<TopProduct>>(raw?.topProducts).map((p) => ({
      ...p,
      productSlug: str(p.productSlug),
    }) as TopProduct),
    recentOrders: arr<RecentOrder>(raw?.recentOrders),
    customerChart: arr<CustomerChartPoint>(raw?.customerChart),
    profit: {
      thisMonth: num(profit.thisMonth),
      lastMonth: num(profit.lastMonth),
      grossRevenue: num(profit.grossRevenue),
      vendorCost: num(profit.vendorCost),
      trend: arr<ProfitData['trend'][number]>(profit.trend),
    },
    topVendors: arr<TopVendor>(raw?.topVendors),
    meta: raw?.meta ?? DEFAULT_META,
  };
}

export interface SparklineDay {
  day: string;
  date: string;
  orders: number;
  revenue: number;
}

export interface StatCards {
  period: { orders: number; revenue: number };
  previous: { orders: number; revenue: number };
  today: { orders: number; revenue: number };
  yesterday: { orders: number; revenue: number };
  pendingOrders: number;
  lowStockCount: number;
  avgOrderValue: number;
  sparkline: SparklineDay[];
}

export interface MonthlySales {
  month: string;
  revenue: number;
  orders: number;
  profit: number;
  vendorCost: number;
}

export interface VendorRef {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  color: string;
}

export interface TopProduct {
  id: string;
  name: string;
  /** Central catalog slug — server may omit it (older payloads); deep links must default to ''. */
  productSlug?: string;
  image: string | null;
  sku: string;
  sold: number;
  revenue: number;
  stock: number;
  stockStatus: string;
  margin: number | null;
  vendor: VendorRef | null;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customer: string;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  placedAt: string;
  hasAccount: boolean;
  vendors: string[];
}

export interface CustomerChartPoint {
  month: string;
  newCustomer: number;
  returningCustomer: number;
}

export interface PaymentBreakdownItem {
  method: string;
  count: number;
  total: number;
}

export interface TopVendor {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  color: string;
  revenueModel: string;
  grossRevenue: number;
  /** Platform's cost for this vendor's goods = vendor payout owed */
  vendorCost: number;
  /** Platform's profit from this vendor's items = grossRevenue - vendorCost */
  platformProfit: number;
  orderCount: number;
  itemCount: number;
}

export interface ProfitData {
  /** Platform markup earned this month (= grossRevenue - vendorCost) */
  thisMonth: number;
  /** Platform markup earned last month */
  lastMonth: number;
  /** Gross revenue from all active orders this month */
  grossRevenue: number;
  /** Platform's cost = Σ vendor payouts (what platform owes vendors) */
  vendorCost: number;
  trend: {
    month: string;
    totalSales: number;
    vendorCost: number;
    profit: number;
  }[];
}

export interface DashboardData {
  statCards: StatCards;
  salesReport: MonthlySales[];
  statusBreakdown: Record<string, number>;
  paymentBreakdown: PaymentBreakdownItem[];
  topProducts: TopProduct[];
  recentOrders: RecentOrder[];
  customerChart: CustomerChartPoint[];
  profit: ProfitData;
  topVendors: TopVendor[];
  meta: PeriodMeta;
}

export async function getDashboardData(
  token: string,
  params: DashboardParams = {}
): Promise<DashboardData> {
  // Whitelist/validate before the network hop: a garbage `?period=` must
  // render the default period, not reach the API as a broken query.
  const qs = buildDashboardQuery(resolveDashboardParams(params));
  const res = await fetch(`${API_URL}/api/analytics/dashboard${qs}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = (await res.json()) as {
    success: boolean;
    message?: string;
    data: DashboardData;
  };
  if (!res.ok || !data.success)
    throw new Error(data.message || 'Failed to load dashboard');
  // Normalise partial payloads so widgets degrade per-section instead of
  // crashing on a missing section.
  return normalizeDashboardData(data.data);
}
