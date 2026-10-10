'use client';

export interface OrderItem {
  netSales?: number;
  netQuantity?: number;
  returnedQuantity?: number;
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
  /**
   * This line's share of the receipt's commercial gross, as allocated
   * server-side. Sums back to the receipt total, so gross − returns === net.
   */
  grossShare?: number;
  /** Value of this line removed by returns. The tip is never counted here. */
  returnedValue?: number;
  /**
   * What this stock was bought for when it was sold. `sizeCostPrice` is the
   * Size model's *current* cost, so a profit report built on it rewrites
   * history every time a cost price is edited.
   */
  costPriceAtPurchase?: number;
  sizeCostPrice?: number;
  category?: string;
  subcategory?: string;
  brand?: string;
  warehouse?: { _id: string; name: string; code: string } | null;
}

export interface PosOrder {
  _id: string;
  orderNumber?: string;
  receiptNumber?: string;
  total: number;
  subtotal?: number;
  discountTotal?: number;
  paymentMethod: string;
  paymentDetails?: { splitPayments?: { method: string; amount: number }[] } | null;
  paymentStatus?: string;
  status?: string;
  isVoided?: boolean;
  placedAt: string;
  createdAt: string;
  posStaff?: { firstName: string; lastName: string; posName?: string };
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  items?: OrderItem[];
}

export interface LineRow {
  orderId: string;
  orderNumber: string;
  receiptNumber: string;
  date: string;
  cashier: string;
  product: string;
  variant: string;
  category: string;
  subcategory: string;
  brand: string;
  qty: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  gross: number;
  /** Server allocation of the receipt's commercial gross to this line. */
  grossShare: number;
  /** Value removed from this line by returns. */
  returnedValue: number;
  costPrice: number;
  /**
   * False when the line carries no cost basis at all. `profit` is then a gap
   * rather than a margin, and the summary reports the revenue it covers as
   * uncosted so the total is not read as a 0% margin on a real sale.
   */
  hasCost: boolean;
  profit: number;
  paymentMethod: string;
  /** True when the receipt was tendered across more than one method. */
  splitPayment: boolean;
  /** Every tender on the receipt, so a split is never hidden behind one label. */
  paymentShares: { method: string; amount: number }[];
  isVoided: boolean;
  warehouse: string;
}

export type LineSortField = keyof Pick<
  LineRow,
  | 'date'
  | 'orderNumber'
  | 'cashier'
  | 'product'
  | 'variant'
  | 'category'
  | 'subcategory'
  | 'brand'
  | 'qty'
  | 'unitPrice'
  | 'discount'
  | 'subtotal'
  | 'gross'
  | 'profit'
  | 'paymentMethod'
>;

export interface GroupRow {
  key: string;
  qty: number;
  gross: number;
  /** Value removed from this group by returns. */
  returns: number;
  discount: number;
  revenue: number;
  costedRevenue: number;
  uncostedRevenue: number;
  profit: number;
  margin: number;
  lineCount: number;
  orderCount: number;
  share: number;
}

export type GroupSortField =
  | 'key'
  | 'qty'
  | 'revenue'
  | 'gross'
  | 'discount'
  | 'profit'
  | 'lineCount'
  | 'orderCount'
  | 'share';

export type GroupByKey =
  | 'product'
  | 'cashier'
  | 'payment_method'
  | 'date'
  | 'variant'
  | 'warehouse';

export type ViewMode = 'lines' | 'grouped';
export type StatusFilter = 'all' | 'active' | 'voided';

export type ToggleableCol =
  | 'orderNumber'
  | 'cashier'
  | 'variant'
  | 'category'
  | 'subcategory'
  | 'brand'
  | 'unitPrice'
  | 'gross'
  | 'discount'
  | 'payment';

export type LineExportCol =
  | 'date'
  | 'order'
  | 'receipt'
  | 'cashier'
  | 'product'
  | 'variant'
  | 'category'
  | 'subcategory'
  | 'brand'
  | 'qty'
  | 'unitPrice'
  | 'gross'
  | 'returns'
  | 'discount'
  | 'net'
  | 'cost'
  | 'profit'
  | 'margin'
  | 'payment'
  | 'voided';

export type GroupExportCol =
  | 'key'
  | 'qty'
  | 'gross'
  | 'returns'
  | 'discount'
  | 'revenue'
  | 'profit'
  | 'margin'
  | 'share'
  | 'lineCount'
  | 'orderCount';

export interface PdfMeta {
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  cashierFilter: string;
  methodFilter: string;
  statusFilter: StatusFilter;
  storeName: string;
  // The same summary the on-screen strip shows, so a PDF cannot disagree with
  // the page it was exported from.
  summary: LinesSummary;
}

export interface SelectOption {
  value: string;
  label: string;
  dot?: string;
}

/**
 * Summary figures for the sales-details strip.
 *
 * The identity `gross − returns === revenue` holds by construction, and a
 * discount is disclosed rather than subtracted (the net figure already has it
 * taken out). Margin is measured against `costedRevenue` so that revenue with
 * no cost basis cannot quietly drag it down.
 */
export interface LinesSummary {
  lines: number;
  orders: number;
  gross: number;
  returns: number;
  revenue: number;
  discount: number;
  costedRevenue: number;
  uncostedRevenue: number;
  profit: number;
  margin: number;
  items: number;
  avgOrder: number;
}

export interface VoidSummary {
  count: number;
  revenue: number;
}
