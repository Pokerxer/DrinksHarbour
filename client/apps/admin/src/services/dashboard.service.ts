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
  period?: string;
  from?: string;
  to?: string;
}

/**
 * Serialise dashboard params into a query string. Unknown periods are dropped
 * rather than forwarded — the server also degrades to its default, but there is
 * no reason to send a request we already know is meaningless.
 */
export function buildDashboardQuery(params: DashboardParams): string {
  const { period, from, to } = params;
  if (!period || !PERIOD_KEYS.includes(period as PeriodKey)) return '';

  if (period === 'custom') {
    if (!from || !to) return '';
    return `?period=custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }

  return `?period=${period}`;
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
  const qs = buildDashboardQuery(params);
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
  return data.data;
}
