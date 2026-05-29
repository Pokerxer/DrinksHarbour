import Dexie, { type Table } from 'dexie';

export interface ProductRecord {
  _id: string;
  name: string;
  sku?: string;
  baseSellingPrice: number;
  availableStock: number;
  sizes: {
    _id: string;
    displayName: string;
    sellingPrice: number;
    availableStock: number;
    sku?: string;
  }[];
  images?: { url: string; thumbnail?: string }[];
  categoryId?: string;
  brandId?: string;
  costPrice?: number;
  activeBundles?: object[];
  updatedAt: string;
}

export interface ComboRecord {
  _id: string;
  name: string;
  price: number;
  items: object[];
  updatedAt: string;
}

export interface SessionRecord {
  _id: 'current';
  sessionId: string;
  terminalType: 'retail' | 'wholesale';
  openedAt: string;
  orderCount: number;
  totalSales: number;
  methodBalances: { method: string; amount: number }[];
}

export interface OrderRecord {
  _id: string;
  receiptNumber?: string;
  total: number;
  paymentMethod: string;
  paymentStatus?: string;
  items?: object[];
  refunds?: object[];
  isVoided?: boolean;
  createdAt: string;
  posStaff?: object;
  customer?: object;
}

export type QueueEntryType = 'order' | 'refund' | 'void';
export type QueueEntryStatus = 'pending' | 'syncing' | 'failed';

export interface QueueEntry {
  id?: number;
  type: QueueEntryType;
  payload: object;
  tempReceiptNumber?: string;
  orderId?: string;
  createdAt: string;
  status: QueueEntryStatus;
  retries: number;
  errorMessage?: string;
}

export interface StockAdjust {
  id?: number;
  productId: string;
  sizeId?: string;
  delta: number;
  queueId: number;
}

export class POSDatabase extends Dexie {
  products!: Table<ProductRecord, string>;
  combos!: Table<ComboRecord, string>;
  session!: Table<SessionRecord, string>;
  orders!: Table<OrderRecord, string>;
  offlineQueue!: Table<QueueEntry, number>;
  stockAdjust!: Table<StockAdjust, number>;

  constructor() {
    super('pos-offline-v1');
    this.version(1).stores({
      products: '_id, updatedAt',
      combos: '_id',
      session: '_id',
      orders: '_id, createdAt',
      offlineQueue: '++id, status, createdAt, type',
      stockAdjust: '++id, productId, sizeId, queueId',
    });
  }
}

export const posDb = new POSDatabase();
