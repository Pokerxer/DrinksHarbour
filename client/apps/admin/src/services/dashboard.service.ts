const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export interface SparklineDay {
  day: string;
  date: string;
  orders: number;
  revenue: number;
}

export interface StatCards {
  thisMonth:     { orders: number; revenue: number };
  lastMonth:     { orders: number; revenue: number };
  today:         { orders: number; revenue: number };
  yesterday:     { orders: number; revenue: number };
  pendingOrders: number;
  lowStockCount: number;
  avgOrderValue: number;
  sparkline:     SparklineDay[];
}

export interface MonthlySales {
  month:      string;
  revenue:    number;
  orders:     number;
  profit:     number;
  vendorCost: number;
}

export interface VendorRef {
  id:    string;
  name:  string;
  slug:  string;
  logo:  string | null;
  color: string;
}

export interface TopProduct {
  id:          string;
  name:        string;
  image:       string | null;
  sku:         string;
  sold:        number;
  revenue:     number;
  stock:       number;
  stockStatus: string;
  margin:      number | null;
  vendor:      VendorRef | null;
}

export interface RecentOrder {
  id:            string;
  orderNumber:   string;
  customer:      string;
  total:         number;
  status:        string;
  paymentStatus: string;
  paymentMethod: string;
  placedAt:      string;
  hasAccount:    boolean;
  vendors:       string[];
}

export interface CustomerChartPoint {
  month:             string;
  newCustomer:       number;
  returningCustomer: number;
}

export interface PaymentBreakdownItem {
  method: string;
  count:  number;
  total:  number;
}

export interface TopVendor {
  id:             string;
  name:           string;
  slug:           string;
  logo:           string | null;
  color:          string;
  revenueModel:   string;
  grossRevenue:   number;
  /** Platform's cost for this vendor's goods = vendor payout owed */
  vendorCost:     number;
  /** Platform's profit from this vendor's items = grossRevenue - vendorCost */
  platformProfit: number;
  orderCount:     number;
  itemCount:      number;
}

export interface ProfitData {
  /** Platform markup earned this month (= grossRevenue - vendorCost) */
  thisMonth:    number;
  /** Platform markup earned last month */
  lastMonth:    number;
  /** Gross revenue from all active orders this month */
  grossRevenue: number;
  /** Platform's cost = Σ vendor payouts (what platform owes vendors) */
  vendorCost:   number;
  trend: {
    month:      string;
    totalSales: number;
    vendorCost: number;
    profit:     number;
  }[];
}

export interface DashboardData {
  statCards:        StatCards;
  salesReport:      MonthlySales[];
  statusBreakdown:  Record<string, number>;
  paymentBreakdown: PaymentBreakdownItem[];
  topProducts:      TopProduct[];
  recentOrders:     RecentOrder[];
  customerChart:    CustomerChartPoint[];
  profit:           ProfitData;
  topVendors:       TopVendor[];
}

export async function getDashboardData(token: string): Promise<DashboardData> {
  const res  = await fetch(`${API_URL}/api/analytics/dashboard`, { headers: authHeaders(token) });
  const data = await res.json() as { success: boolean; message?: string; data: DashboardData };
  if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load dashboard');
  return data.data;
}
