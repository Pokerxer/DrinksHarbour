'use client';

export interface OrderItem {
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
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
  costPrice: number;
  profit: number;
  paymentMethod: string;
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
  discount: number;
  revenue: number;
  profit: number;
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
  summary: {
    gross: number;
    revenue: number;
    discount: number;
    items: number;
    orders: number;
    profit: number;
    avgOrder: number;
  };
}

export interface SelectOption {
  value: string;
  label: string;
  dot?: string;
}

export interface SalesSummary {
  revenue: number;
  items: number;
  discount: number;
  gross: number;
  profit: number;
  orders: number;
  avgOrder: number;
}

export interface VoidSummary {
  count: number;
  revenue: number;
}
