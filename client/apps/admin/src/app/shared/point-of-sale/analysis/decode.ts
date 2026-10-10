// Wire format for GET /api/pos/orders/analysis, and the decode back into the
// ReportOrder shape the measures read.
//
// The server sends short keys because the response is one row per line across
// the whole period. Decoding is a rename, never a recalculation: every money
// figure arrives already authoritative from posReturnTotals.service, and this
// file must never derive one of its own or the chart would disagree with the
// receipt.

import type { ReportOrder, ReportOrderItem } from '../report-totals';

export interface AnalysisLineRow {
  o: string;
  n: string;
  v: string;
  c: string;
  s: string;
  b: string;
  w: string;
  q: number;
  r: number;
  g: number;
  d: number;
  t: number;
  k: number;
  x: number;
  rq: number;
}

export interface AnalysisOrderRow {
  _id: string;
  orderNumber?: string;
  receiptNumber?: string;
  total: number;
  grossRevenue: number;
  netSales: number;
  returnDeduction: number;
  totalRefunds: number;
  salesReturnValue: number;
  netCollections: number;
  tipAmount: number;
  roundingAmount: number;
  discountTotal: number;
  lineDiscountTotal: number;
  taxAmount?: number;
  subtotal?: number;
  paymentMethod: string;
  paymentStatus?: string;
  status?: string;
  isVoided: boolean;
  placedAt: string;
  createdAt: string;
  posStaff?: { firstName: string; lastName: string; posName?: string } | null;
  customer?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    customerId?: string | null;
  } | null;
  session?: { _id: string; terminalType?: string } | null;
  splitPayments: { method: string; amount: number }[];
}

export interface AnalysisMeta {
  scanned: number;
  included: number;
  lines: number;
  truncated: boolean;
  maxLines: number;
  matched: number;
  shopId: string | null;
}

export interface AnalysisPayloadRow {
  order: AnalysisOrderRow;
  lines: AnalysisLineRow[];
}

export function decodeLine(row: AnalysisLineRow): ReportOrderItem {
  return {
    name: row.n,
    variant: row.v || undefined,
    quantity: row.q,
    netQuantity: row.q,
    priceAtPurchase: row.g && row.q ? row.g / row.q : 0,
    itemSubtotal: row.r,
    netSales: row.r,
    grossSubtotal: row.g,
    discountAmount: row.d,
    taxAmount: row.t,
    taxRate: 0,
    // 0 on both means the tenant never costed this line. Kept as 0 rather than
    // falling back, so the report shows the revenue as uncosted instead of
    // booking a 100% margin on it.
    costPriceAtPurchase: row.k,
    sizeCostPrice: row.x,
    returnedQuantity: row.rq,
    category: row.c,
    subcategory: row.s,
    brand: row.b,
    warehouse: row.w ? { _id: '', name: row.w } : null,
  };
}

export function decodeOrder(payload: AnalysisPayloadRow): ReportOrder {
  const o = payload.order;
  return {
    _id: o._id,
    orderNumber: o.orderNumber,
    receiptNumber: o.receiptNumber,
    total: o.total,
    subtotal: o.subtotal,
    grossRevenue: o.grossRevenue,
    netSales: o.netSales,
    returnDeduction: o.returnDeduction,
    totalRefunds: o.totalRefunds,
    salesReturnValue: o.salesReturnValue,
    netCollections: o.netCollections,
    tipAmount: o.tipAmount,
    totalTips: o.tipAmount,
    roundingAmount: o.roundingAmount,
    totalRounding: o.roundingAmount,
    discountTotal: o.discountTotal,
    lineDiscountTotal: o.lineDiscountTotal,
    taxAmount: o.taxAmount,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    isVoided: o.isVoided,
    placedAt: o.placedAt,
    createdAt: o.createdAt,
    posStaff: o.posStaff ?? undefined,
    customer: o.customer ?? null,
    session: o.session ?? null,
    paymentDetails: { splitPayments: o.splitPayments },
    items: payload.lines.map(decodeLine),
    refunds: [],
  };
}

export function decodeAnalysis(
  rows: AnalysisPayloadRow[]
): ReportOrder[] {
  return rows.map(decodeOrder);
}
