import { posApi } from '../api';
import { resolveSubProductGallery } from '@/app/shared/ecommerce/sub-product/image-utils';
import { catalogueImageKeys, POS_IMAGES_UPDATED } from './image-cache';
import { precacheImages, pruneImages } from './image-store';
import { posDb } from './db';
import type {
  ProductRecord,
  OrderRecord,
  SessionRecord,
  QueueEntry,
} from './db';

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

function recordToPOSProduct(r: ProductRecord): any {
  return {
    _id: r._id,
    sku: r.sku,
    product: { _id: r._id, name: r.name, images: r.images ?? [] },
    baseSellingPrice: r.baseSellingPrice,
    availableStock: r.availableStock,
    costPrice: r.costPrice,
    sizes: r.sizes,
    activeBundles: r.activeBundles ?? [],
    stockStatus: r.availableStock > 0 ? 'in_stock' : 'out_of_stock',
    status: 'active',
    sellWithoutSizeVariants: !(r.sizes?.length > 0),
    visibleInPOS: true,
    isOnSale: false,
  };
}

export async function getProducts(
  token: string,
  shopId?: string,
  warehouseId?: string
): Promise<any[]> {
  if (isOnline()) {
    const data = await posApi.getProducts(token, {
      ...(shopId ? { shopId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
    });
    const products: any[] = data?.products ?? [];
    // The grid searches this array and nothing else, so a clipped catalogue
    // reads as "that product does not exist" at the till. The server caps at
    // 5000; say so rather than letting the tail disappear quietly.
    if (data?.truncated) {
      console.warn(
        `[POS] the catalogue was capped at ${data.limit ?? products.length} products. ` +
          'Anything past the cap cannot be found or sold from this terminal.'
      );
    }
    // Flatten to Dexie records for offline use, mapping nested POSProduct fields
    const records: ProductRecord[] = products.map((p: any) => ({
      _id: p._id,
      name: p.product?.name ?? p.name ?? '',
      sku: p.sku,
      baseSellingPrice: p.baseSellingPrice ?? 0,
      availableStock: p.availableStock ?? 0,
      sizes: (p.sizes ?? []).map((s: any) => ({
        _id: s._id,
        displayName: s.displayName ?? s.name ?? '',
        sellingPrice: s.sellingPrice ?? 0,
        availableStock: s.availableStock ?? 0,
        sku: s.sku,
      })),
      // Store the already-resolved gallery: the record is flattened onto a
      // synthetic `product` on the way back out, so an unresolved override
      // would be lost and the offline tile would show the parent's photo.
      images: resolveSubProductGallery(p),
      categoryId: p.product?.category?._id ?? p.categoryId,
      brandId: p.product?.brand?._id ?? p.brandId,
      costPrice: p.costPrice,
      activeBundles: p.activeBundles,
      updatedAt: p.updatedAt ?? new Date().toISOString(),
    }));
    await posDb.products.bulkPut(records);

    // Pull the image bytes into Dexie so the grid survives a network drop. The
    // catalogue record only ever held URLs, and a cached URL is still just a
    // URL — offline it resolves to nothing and the tile paints blank, which is
    // indistinguishable from one of the sub-products that genuinely has no
    // photo. Not awaited: the till must open now, images fill in behind it.
    void cacheCatalogueImages(products);

    return products; // Return original POSProduct[] for the grid
  }
  const records = await posDb.products.toArray();
  return records.map(recordToPOSProduct);
}

/**
 * Fetch and store the bytes behind this catalogue's images, then drop the bytes
 * it no longer references.
 *
 * Eager rather than cache-on-first-view: what a cashier scrolls past is the
 * fast-moving head of the catalogue, and what they have to look up is the tail
 * — so caching only what was viewed leaves precisely the products that need an
 * image without one. Measured at ~10.6 KB per w_300 derivative, the whole of
 * Wyn City's 530 images is ~5.6 MB.
 *
 * A shortfall is announced, never swallowed: a half-filled cache renders
 * exactly like a full one until the network goes and the cashier is standing in
 * front of a customer.
 */
async function cacheCatalogueImages(products: any[]): Promise<void> {
  try {
    const keys = catalogueImageKeys(products);
    const report = await precacheImages(keys);
    if (report.failed > 0) {
      console.warn(
        `[POS] ${report.failed} of ${report.requested} product images could not be cached. ` +
          'Those tiles will be blank if this terminal goes offline.'
      );
    }
    await pruneImages(keys);
    // Only when something actually arrived — otherwise every reload churns
    // hundreds of object URLs to land on the map it already had.
    if (report.fetched > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(POS_IMAGES_UPDATED));
    }
  } catch (err) {
    console.warn('[POS] product image caching failed outright:', err);
  }
}

export async function getProductsWithLocalStock(): Promise<any[]> {
  const products = await posDb.products.toArray();
  const adjusts = await posDb.stockAdjust.toArray();

  const deltaMap = new Map<string, number>();
  for (const a of adjusts) {
    const key = a.sizeId ? `${a.productId}:${a.sizeId}` : a.productId;
    deltaMap.set(key, (deltaMap.get(key) ?? 0) + a.delta);
  }

  return products.map((r) =>
    recordToPOSProduct({
      ...r,
      availableStock: r.availableStock + (deltaMap.get(r._id) ?? 0),
      sizes: r.sizes.map((s) => ({
        ...s,
        availableStock:
          s.availableStock + (deltaMap.get(`${r._id}:${s._id}`) ?? 0),
      })),
    })
  );
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function getSessionInfo(
  token: string
): Promise<SessionRecord | null> {
  if (isOnline()) {
    try {
      const data = await posApi.getSessionInfo(token);
      if (data) {
        const record: SessionRecord = {
          _id: 'current',
          sessionId: (data as any)._id ?? (data as any).sessionId,
          terminalType: (data as any).terminalType ?? 'retail',
          openedAt:
            (data as any).openedAt ??
            (data as any).createdAt ??
            new Date().toISOString(),
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

export async function getSessionOrders(
  token: string,
  sessionId: string
): Promise<OrderRecord[]> {
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

function mapPayloadItems(items: any[]): any[] {
  return (items ?? []).map((item: any) => {
    const unitPrice = item.clientPrice ?? item.price ?? 0;
    const lineGross = unitPrice * (item.quantity ?? 1);
    const discAmt =
      Math.round(lineGross * ((item.discount ?? 0) / 100) * 100) / 100;
    return {
      name: item.name ?? '',
      variant: item.variant ?? '',
      sku: item.sku ?? '',
      quantity: item.quantity ?? 1,
      priceAtPurchase: unitPrice,
      itemSubtotal: lineGross - discAmt,
      discountAmount: discAmt,
      bxgyRole: item.bxgyRole,
    };
  });
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
      items: mapPayloadItems(p.items),
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

  const now = new Date().toISOString();
  const orderTotal: number = p.total ?? 0;
  const amountTendered: number = p.amountTendered ?? orderTotal;
  const receiptItems = mapPayloadItems(p.items);

  return {
    order: {
      _id: `offline-${queueId}`,
      receiptNumber: tempReceipt,
      total: orderTotal,
      subtotal: p.subtotal,
      discountTotal: p.discountValue ?? 0,
      paymentMethod: p.paymentMethod ?? '',
      amountTendered,
      splitPayments: p.splitPayments ?? [],
      change: Math.max(0, amountTendered - orderTotal),
      items: receiptItems,
      placedAt: now,
      posStaff: '',
      note: p.note,
      paymentStatus: 'pending_sync',
      isOffline: true,
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
  if (isOnline())
    return posApi.refundOrder(
      token,
      orderId,
      items,
      reason,
      refundPaymentMethod
    );

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

// ── Reconcile a linked Sales Order ────────────────────────────────────────────
//
// Queued beside the sale rather than refused while offline: refusing to load a
// quotation with the network down breaks the one case the offline POS exists
// for. The queue drains in createdAt order, so this replays after the sale it
// belongs to; `ref` (the receipt number, or the temporary one assigned offline)
// lets the server recognise a replay of an entry whose response was lost
// instead of fulfilling and charging a second time.
export async function reconcileSalesOrder(
  token: string,
  salesOrderId: string,
  body: {
    paymentMethod?: string;
    ref?: string;
    warehouseId?: string;
    items?: { subProductId: string; sizeId?: string; quantity: number }[];
  }
): Promise<any> {
  if (isOnline()) return posApi.reconcileSalesOrder(token, salesOrderId, body);

  await posDb.offlineQueue.add({
    type: 'reconcile',
    payload: { salesOrderId, ...body, _token: token },
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
