export type POStatus =
  | 'draft'
  | 'confirmed'
  | 'received'
  | 'billed'
  | 'cancel'
  | 'validated'
  | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type BillStatus = 'draft' | 'posted' | 'paid' | 'cancelled';
export type ReturnStatus = 'draft' | 'confirmed' | 'requested' | 'shipped' | 'in_transit' | 'received' | 'refunded' | 'rejected' | 'cancelled';
export type AgreementStatus =
  | 'draft'
  | 'active'
  | 'expired'
  | 'exhausted'
  | 'cancelled';
export type AgreementType = 'blanket_order' | 'call_for_tender' | 'none';

export interface POItem {
  subProductId: string;
  productName: string;
  sku: string;
  size?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  packSize: number;
  packQty: number;
  unitPrice: number;
  packPrice: number;
  receivedQty: number;
  type: string;
  uom?: string;
  taxRate?: number;
  totalCost?: number;
  // Parent-product batch-tracking flags, surfaced by the single-PO endpoint so
  // the receiving UI can prompt for batch number + expiry on tracked lines.
  tracksBatch?: boolean;
  isAlcoholic?: boolean;
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  vendor?: string;
  vendorName?: string;
  vendorReference?: string;
  currency: string;
  confirmationDate?: string;
  expectedArrival?: string;
  arrivalDate?: string;
  items: POItem[];
  notes?: string;
  status: POStatus;
  type?: 'rfq' | 'po';
  tenant?: string;
  createdAt?: string;
  updatedAt?: string;
  validUntil?: string;
  termsConditions?: string;
  originalPO?: string;
  isBackorder?: boolean;
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  isLocked?: boolean;
  lockedAt?: string;
  lockedBy?: string;
  lockedByName?: string;
  lockReason?: string;
  purchaseAgreement?:
    | string
    | { _id: string; agreementNumber?: string; name?: string; status?: string };
  agreementType?: AgreementType;
}

export interface VendorBill {
  _id: string;
  billNumber: string;
  purchaseOrder?: string;
  vendor?: string;
  vendorName?: string;
  billDate?: string;
  dueDate?: string;
  currency: string;
  items: BillItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: BillStatus;
  notes?: string;
  createdAt?: string;
}

export interface BillItem {
  subProductId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  total: number;
}

export interface VendorReturn {
  _id: string;
  returnNumber: string;
  vendor?: string | { _id: string; name?: string; email?: string; phone?: string };
  vendorName?: string;
  purchaseOrder?: string | { _id: string; poNumber?: string };
  poNumber?: string;
  vendorBill?: string;
  billNumber?: string;
  currency: string;
  items: ReturnItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: ReturnStatus;
  returnDate?: string;
  requestedDate?: string;
  shippedDate?: string;
  receivedDate?: string;
  refundedDate?: string;
  reason?: string;
  notes?: string;
  internalNotes?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  returnAddress?: string;
  refundAmount: number;
  refundStatus: string;
  refundMethod?: string;
  refundReference?: string;
  refundDate?: string;
  createdBy?: string | { _id: string; name?: string; email?: string };
  confirmedBy?: string | { _id: string; name?: string; email?: string };
  confirmedAt?: string;
  receivedBy?: string | { _id: string; name?: string; email?: string };
  receivedByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReturnItem {
  subProductId?: string;
  subProductName?: string;
  sku?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  reason?: string;
  condition?: string;
  taxRate?: number;
}

export interface Vendor {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  notes?: string;
  paymentTerms?: 'prepaid' | 'net_7' | 'net_14' | 'net_30' | 'net_60';
  isActive?: boolean;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  contactPerson?: { name?: string; email?: string; phone?: string };
}

export interface PurchaseAgreement {
  _id: string;
  agreementNumber: string;
  name: string;
  agreementType: AgreementType;
  selectionType?: 'exclusive' | 'non_exclusive';
  vendor?:
    | string
    | { _id: string; name?: string; email?: string; phone?: string };
  vendorName?: string;
  currency: string;
  status: AgreementStatus;
  startDate?: string;
  endDate?: string;
  totalQuantity?: number;
  consumedQuantity?: number;
  totalAmount?: number;
  consumedAmount?: number;
  termsConditions?: string;
  notes?: string;
  items?: AgreementItem[];
  tenderResponses?: AgreementTenderResponse[];
  purchaseOrders?: {
    _id: string;
    poNumber?: string;
    status?: string;
    totalAmount?: number;
  }[];
  approvedAt?: string;
  createdAt?: string;
}

export interface AgreementItem {
  subProductId: string;
  subProductName: string;
  sku?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  consumedQuantity?: number;
  unitPrice: number;
  totalPrice?: number;
  packaging?: string;
  packagingQty?: number;
  leadTimeDays?: number;
}

export interface AgreementTenderResponse {
  vendorId?: string;
  vendorName: string;
  submittedAt?: string;
  totalAmount?: number;
  currency?: string;
  notes?: string;
  deliveryDate?: string;
  validityDate?: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
}

// statusLabel() maps draft → 'RFQ' for purchase orders; agreements need their own labels.
export const AGREEMENT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  expired: 'Expired',
  exhausted: 'Exhausted',
  cancelled: 'Cancelled',
};

export const AGREEMENT_TYPE_LABEL: Record<string, string> = {
  blanket_order: 'Blanket Order',
  call_for_tender: 'Call for Tender',
  none: 'None',
};

export interface VendorPricelist {
  _id: string;
  name: string;
  vendor?: string;
  vendorName?: string;
  currency: string;
  isActive: boolean;
  items: PricelistItem[];
  createdAt?: string;
}

export interface PricelistItem {
  subProductId: string;
  productName: string;
  unitPrice: number;
  minQuantity?: number;
}

export interface UomConversion {
  _id: string;
  name: string;
  fromUOM: string;
  toUOM: string;
  conversionFactor: number;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
}

// Must stay in sync with the UOM enum on the server (models/UOMConversion.js).
export const UOMS = [
  'Units',
  'Cases',
  'Packs',
  'Bottles',
  'Cartons',
  'Boxes',
  'Pallets',
  'Liters',
  'Milliliters',
  'Gallons',
] as const;

export interface ExchangeRate {
  _id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  isActive: boolean;
  source?: 'manual' | 'live';
  notes?: string;
  createdAt?: string;
}

// Must stay in sync with the currency enums on the server
// (models/ExchangeRate.js, models/PurchaseOrder.js, models/VendorBill.js).
export const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const BASE_CURRENCY: Currency = 'NGN';
export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function fmtPrice(n: number | undefined | null, currency = 'NGN'): string {
  const safe = (typeof n === 'number' && !Number.isNaN(n)) ? n : 0;
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${symbol}${safe.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface PurchaseAnalyticsSummary {
  totalOrders: number;
  totalSpend: number;
  pendingBills: number;
  pendingBillsAmount: number;
  overdueAmount: number;
  topVendors: { vendorName: string; totalSpend: number; orderCount: number }[];
}

export const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  rfq: 'bg-gray-200 text-gray-700',
  confirmed: 'bg-blue-200 text-blue-800',
  purchase: 'bg-blue-200 text-blue-800',
  received: 'bg-emerald-200 text-emerald-800',
  done: 'bg-emerald-200 text-emerald-800',
  billed: 'bg-violet-200 text-violet-800',
  cancel: 'bg-red-200 text-red-700',
  cancelled: 'bg-red-200 text-red-700',
  validated: 'bg-emerald-200 text-emerald-800',
  locked: 'bg-amber-200 text-amber-800',
  posted: 'bg-blue-200 text-blue-800',
  paid: 'bg-emerald-200 text-emerald-800',
  active: 'bg-emerald-200 text-emerald-800',
  expired: 'bg-amber-200 text-amber-800',
  exhausted: 'bg-violet-200 text-violet-800',
  closed: 'bg-gray-200 text-gray-700',
  pending: 'bg-amber-200 text-amber-800',
  approved: 'bg-emerald-200 text-emerald-800',
  rejected: 'bg-red-200 text-red-700',
  requested: 'bg-blue-200 text-blue-800',
  shipped: 'bg-cyan-200 text-cyan-800',
  in_transit: 'bg-indigo-200 text-indigo-800',
};

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'RFQ',
    confirmed: 'Purchase Order',
    purchase: 'Purchase Order',
    received: 'Received',
    done: 'Done',
    billed: 'Billed',
    cancel: 'Cancelled',
    cancelled: 'Cancelled',
    validated: 'Validated',
    posted: 'Posted',
    paid: 'Paid',
    active: 'Active',
    closed: 'Closed',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    refunded: 'Refunded',
    requested: 'Requested',
    shipped: 'Shipped',
    in_transit: 'In Transit',
  };
  return labels[status] ?? status;
}

/** Status labels for return-specific contexts (avoids PO-centric defaults) */
export function returnStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    confirmed: 'Confirmed',
    requested: 'Requested',
    shipped: 'Shipped',
    in_transit: 'In Transit',
    received: 'Received',
    refunded: 'Refunded',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? status;
}
