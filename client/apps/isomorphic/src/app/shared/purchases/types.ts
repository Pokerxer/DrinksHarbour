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
export type ReturnStatus = 'draft' | 'confirmed' | 'refunded' | 'cancelled';
export type AgreementStatus = 'draft' | 'active' | 'closed' | 'cancelled';
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
  purchaseAgreement?: string;
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
  purchaseOrder?: string;
  vendor?: string;
  vendorName?: string;
  items: ReturnItem[];
  status: ReturnStatus;
  notes?: string;
  refundAmount?: number;
  createdAt?: string;
}

export interface ReturnItem {
  subProductId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  reason?: string;
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
  vendor?: string;
  vendorName?: string;
  agreementType: AgreementType;
  status: AgreementStatus;
  startDate?: string;
  endDate?: string;
  items?: AgreementItem[];
  notes?: string;
  createdAt?: string;
}

export interface AgreementItem {
  subProductId: string;
  productName: string;
  quantity?: number;
  unitPrice?: number;
}

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
  fromUom: string;
  toUom: string;
  factor: number;
  notes?: string;
  createdAt?: string;
}

export interface ExchangeRate {
  _id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
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
  closed: 'bg-gray-200 text-gray-700',
  pending: 'bg-amber-200 text-amber-800',
  approved: 'bg-emerald-200 text-emerald-800',
  rejected: 'bg-red-200 text-red-700',
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
  };
  return labels[status] ?? status;
}
