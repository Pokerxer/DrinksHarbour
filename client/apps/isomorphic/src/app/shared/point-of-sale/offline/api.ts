import { posApi } from '../api';
import { posDb } from './db';
import type { ProductRecord, OrderRecord, SessionRecord, QueueEntry } from './db';

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function nextOfflineReceipt(terminal: string): string {
  const key = `dh-pos-offline-counter-${terminal}`;
  const n = parseInt(localStorage.getItem(key) ?? '0', 10) + 1;
  localStorage.setItem(key, String(n));
  return `OFF-${String(n).padStart(3, '0')}`;
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProducts(token: string): Promise<ProductRecord[]> {
  if (isOnline()) {
    const data = await posApi.getProducts(token);
    const records: ProductRecord[] = (data?.products ?? []).map((p: any) => ({
      _id: p._id,
      name: p.name,
      sku: p.sku,
      baseSellingPrice: p.baseSellingPrice ?? 0,
      availableStock: p.availableStock ?? 0,
      sizes: p.sizes ?? [],
      images: p.images,
      categoryId: p.categoryId,
      brandId: p.brandId,
      costPrice: p.costPrice,
      activeBundles: p.activeBundles,
      updatedAt: p.updatedAt ?? new Date().toISOString(),
    }));
    await posDb.products.bulkPut(records);
    return records;
  }
  return posDb.products.toArray();
}

export async function getProductsWithLocalStock(): Promise<ProductRecord[]> {
  const products = await posDb.products.toArray();
  const adjusts = await posDb.stockAdjust.toArray();

  const deltaMap = new Map<string, number>();
  for (const a of adjusts) {
    const key = a.sizeId ? `${a.productId}:${a.sizeId}` : a.productId;
    deltaMap.set(key, (deltaMap.get(key) ?? 0) + a.delta);
  }

  return products.map((p) => ({
    ...p,
    availableStock: p.availableStock + (deltaMap.get(p._id) ?? 0),
    sizes: p.sizes.map((s) => ({
      ...s,
      availableStock: s.availableStock + (deltaMap.get(`${p._id}:${s._id}`) ?? 0),
    })),
  }));
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function getSessionInfo(token: string): Promise<SessionRecord | null> {
  if (isOnline()) {
    try {
      const data = await posApi.getSessionInfo(token);
      if (data) {
        const record: SessionRecord = {
          _id: 'current',
          sessionId: (data as any)._id ?? (data as any).sessionId,
          terminalType: (data as any).terminalType ?? 'retail',
          openedAt: (data as any).openedAt ?? (data as any).createdAt ?? new Date().toISOString(),
          orderCount: (data as any).orderCount ?? 0,
          totalSales: (data as any).totalSales ?? 0,
          methodBalances: (data as any).methodBalances ?? [],
        };
        await posDb.session.put(record);
        return record;
      }
      return null;
    } catch {
      return posDb.session.get('current') ?? null;
    }
  }
  return posDb.session.get('current') ?? null;
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function getAllOrders(token: string): Promise<OrderRecord[]> {
  if (isOnline()) {
    const data = await posApi.getAllOrders(token);
    const records: OrderRecord[] = (data ?? []).map(orderToRecord);
    await posDb.orders.bulkPut(records);
    return records;
  }
  const [dbOrders, queue] = await Promise.all([
    posDb.orders.orderBy('createdAt').reverse().toArray(),
    posDb.offlineQueue.where('type').equals('order').toArray(),
  ]);
  return [...queueToFakeOrders(queue), ...dbOrders];
}

export async function getSessionOrders(token: string, sessionId: string): Promise<OrderRecord[]> {
  if (isOnline()) {
    const data = await posApi.getSessionOrders(token, sessionId);
    const records: OrderRecord[] = (data ?? []).map(orderToRecord);
    await posDb.orders.bulkPut(records);
    return records;
  }
  const [dbOrders, queue] = await Promise.all([
    posDb.orders.orderBy('createdAt').reverse().toArray(),
    posDb.offlineQueue.where('type').equals('order').toArray(),
  ]);
  return [...queueToFakeOrders(queue), ...dbOrders];
}

function orderToRecord(o: any): OrderRecord {
  return {
    _id: o._id,
    receiptNumber: o.receiptNumber,
    total: o.total ?? 0,
    paymentMethod: o.paymentMethod ?? '',
    paymentStatus: o.paymentStatus,
    items: o.items,
    refunds: o.refunds,
    isVoided: o.isVoided,
    createdAt: o.createdAt ?? new Date().toISOString(),
    posStaff: o.posStaff,
    customer: o.customer,
  };
}

function queueToFakeOrders(queue: QueueEntry[]): OrderRecord[] {
  return queue.map((q) => {
    const p = q.payload as any;
    return {
      _id: `offline-${q.id}`,
      receiptNumber: q.tempReceiptNumber,
      total: p.total ?? 0,
      paymentMethod: p.paymentMethod ?? '',
      paymentStatus: 'pending_sync',
      items: p.items,
      createdAt: q.createdAt,
    };
  });
}

// ── Create Order ──────────────────────────────────────────────────────────────

export async function createOrder(
  token: string,
  terminal: string,
  payload: Record<string, unknown>
): Promise<any> {
  if (isOnline()) {
    const data = await posApi.createOrder(token, payload);
    if (data?.order) await posDb.orders.put(orderToRecord(data.order));
    return data;
  }

  const tempReceipt = nextOfflineReceipt(terminal);
  const queueId = await posDb.offlineQueue.add({
    type: 'order',
    payload: { ...payload, _token: token },
    tempReceiptNumber: tempReceipt,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retries: 0,
  });

  const p = payload as any;
  for (const item of p.items ?? []) {
    const delta = -(item.quantity ?? 1);
    await posDb.stockAdjust.add({
      productId: item.subProductId ?? item.productId,
      sizeId: item.sizeId,
      delta,
      queueId: queueId as number,
    });
    if (item.sizeId) {
      await posDb.products
        .where('_id')
        .equals(item.subProductId ?? item.productId)
        .modify((prod) => {
          const sz = prod.sizes.find((s) => s._id === item.sizeId);
          if (sz) sz.availableStock += delta;
        });
    } else {
      await posDb.products
        .where('_id')
        .equals(item.subProductId ?? item.productId)
        .modify((prod) => {
          prod.availableStock += delta;
        });
    }
  }

  return {
    order: {
      _id: `offline-${queueId}`,
      receiptNumber: tempReceipt,
      total: (p as any).total ?? 0,
      paymentMethod: (p as any).paymentMethod ?? '',
      paymentStatus: 'pending_sync',
      isOffline: true,
      createdAt: new Date().toISOString(),
    },
  };
}

// ── Refund / Void ─────────────────────────────────────────────────────────────

export async function refundOrder(
  token: string,
  orderId: string,
  items: {
    orderItemIndex: number;
    quantity: number;
    discPct?: number;
    unitPrice?: number;
    reason?: string;
    restock?: boolean;
  }[],
  reason?: string,
  refundPaymentMethod?: string
): Promise<any> {
  if (isOnline()) return posApi.refundOrder(token, orderId, items, reason, refundPaymentMethod);

  await posDb.offlineQueue.add({
    type: 'refund',
    payload: { items, reason, refundPaymentMethod, _token: token },
    orderId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retries: 0,
  });
  return { success: true, isOffline: true };
}

export async function voidOrder(
  token: string,
  orderId: string,
  reason?: string
): Promise<any> {
  if (isOnline()) return posApi.voidOrder(token, orderId, reason);

  await posDb.offlineQueue.add({
    type: 'void',
    payload: { orderId, reason, _token: token },
    orderId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retries: 0,
  });
  return { success: true, isOffline: true };
}
