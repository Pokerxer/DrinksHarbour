export interface POSStaff {
  _id: string;
  firstName: string;
  lastName: string;
  posName?: string;
  role: string;
  avatar?: string;
  hasPin: boolean;
  posPermissions?: string[];
  terminalPermissions?: {
    retail: boolean;
    wholesale: boolean;
  };
}

export interface POSTenant {
  _id: string;
  slug: string;
  name: string;
  primaryColor?: string;
  logo?: string;
}

export interface POSAuthResponse {
  token: string;
  staff: POSStaff;
  tenant: POSTenant;
}

export interface POSProduct {
  _id: string;
  sku: string;
  product: {
    _id: string;
    name: string;
    images?: { url: string; thumbnail?: string }[];
    type?: string;
    brand?: { name: string };
  };
  vendor?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    posName?: string;
    email?: string;
  };
  baseSellingPrice: number;
  costPrice: number;
  availableStock: number;
  totalStock: number;
  stockStatus: string;
  status: string;
  sizes: POSSize[];
  sellWithoutSizeVariants: boolean;
  defaultSize?: string;
  visibleInPOS: boolean;
  isFeaturedByTenant?: boolean;
  isOnSale: boolean;
  salePrice?: number;
  saleType?: string;
  discount?: number;
  discountType?: string;
}

export interface POSSize {
  _id: string;
  displayName: string;
  sellingPrice: number;
  costPrice?: number;
  availableStock: number;
  stock?: number;
  sku?: string;
}

export interface POSCartItem {
  subProductId: string;
  productId: string;
  sizeId?: string;
  name: string;
  variant: string;
  sku: string;
  image?: string;
  price: number;
  quantity: number;
  discount: number;
  stock: number;
}

export interface POSOrderItem {
  product: string;
  subProduct: string;
  sizeId?: string;
  name: string;
  variant: string;
  sku: string;
  quantity: number;
  price: number;
  discount: number;
  tenantId?: string;
  tenant?: string;
}

export interface POSReceiptItem {
  name: string;
  variant: string;
  sku: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount: number;
}

export interface POSOrderRequest {
  items: POSOrderItem[];
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  paymentMethod: string;
  amountTendered?: number;
  splitPayments?: { method: string; amount: number }[];
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  note?: string;
  sessionId?: string;
  priceOverrides?: Record<string, number>;
}

export interface POSOrderResponse {
  _id: string;
  orderNumber?: string;
  receiptNumber: string;
  total: number;
  subtotal?: number;
  discountTotal?: number;
  paymentMethod: string;
  splitPayments?: { method: string; amount: number }[];
  amountTendered?: number;
  change: number;
  items: POSReceiptItem[];
  note?: string;
  placedAt: string;
  posStaff: string;
}

export interface POSRefundResponse {
  returnNumber: string;
  totalRefunded: number;
  cumulativeRefunded: number;
  paymentStatus: string;
  refundLines: POSRefundLineItem[];
  refundRecord: POSRefundRecord;
  warnings?: string[];
  order: { _id: string; receiptNumber: string };
}

export interface POSSession {
  _id: string;
  tenant: string;
  openedBy: { _id: string; firstName: string; lastName: string; posName?: string; avatar?: string };
  closedBy?: { _id: string; firstName: string; lastName: string; posName?: string };
  activeCashier?: { _id: string; firstName: string; lastName: string; posName?: string; avatar?: string };
  cashierLog: { cashier: string; startedAt: string; endedAt?: string }[];
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  methodBalances: POSMethodBalance[];
  hasDifference: boolean;
  totalSales: number;
  orderCount: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  mobileMoneySales: number;
  splitSales: number;
  notes: string;
  closingNotes: string;
  openingBalance: number;
  closingBalance?: number;
  zReport?: POSZReport;
}

export interface POSMethodBalance {
  method: string;
  opening: number;
  theoretical: number;
  counted: number | null;
  difference: number | null;
}

export interface POSZReport {
  generatedAt?: string;
  totalSales: number;
  totalOrders: number;
  totalRefunds: number;
  totalVoids: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  mobileSales: number;
  openingCash: number;
  expectedCash: number;
  countedCash: number | null;
  cashDifference: number | null;
}

export interface POSDashboardData {
  currentSession: POSSession | null;
  today: { totalSales: number; orderCount: number; breakdown: Record<string, { total: number; count: number }> };
  yesterday: { totalSales: number; orderCount: number; breakdown: Record<string, { total: number; count: number }> };
  thisMonth: { totalSales: number; orderCount: number; breakdown: Record<string, { total: number; count: number }> };
  chartData: { date: string; sales: number; orders: number }[];
  recentOrders: POSRecentOrder[];
}

export interface POSRecentOrder {
  _id: string;
  orderNumber: string;
  total: number;
  paymentMethod: string;
  customer?: { firstName?: string; lastName?: string };
  placedAt: string;
  createdAt: string;
}

export interface POSSessionInfo {
  currentSession: POSSession | null;
  lastSession: { _id: string; closedAt: string; totalSales: number; orderCount: number; closedBy: { firstName: string; lastName: string; posName?: string } } | null;
}

// ── Refund types (Odoo-style) ──────────────────────────────────────────────

export interface POSRefundLineItem {
  orderItemIndex: number;
  quantity: number;
  unitPrice: number;
  discPct: number;
  amount: number;
  restock?: boolean;
  reason?: string;
}

export interface POSRefundRecord {
  receiptNumber: string;
  items: POSRefundLineItem[];
  totalRefunded: number;
  reason?: string;
  refundedBy?: { _id: string; firstName: string; lastName: string; posName?: string };
  refundedAt: string;
  paymentMethod?: string;
}

export interface POSClosingControl {
  sessionId: string;
  openedAt: string;
  openingCash: number;
  totalSales: number;
  orderCount: number;
  methods: {
    method: string;
    opening: number;
    theoretical: number;
    orderTotal: number;
    orderCount: number;
  }[];
}
