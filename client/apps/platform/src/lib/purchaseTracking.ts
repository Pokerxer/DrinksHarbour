import type { purchaseEvent } from './gtag';

type ItemSnapshot = {
  product?: { name?: string; slug?: string } | null;
  subproduct?: { sku?: string } | null;
  size?: { name?: string } | null;
  priceAtPurchase: number;
  quantity: number;
  itemSubtotal: number;
  discountAmount?: number;
};

type PurchaseSnapshot = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  taxAmount?: number;
  currency?: string;
  coupon?: { code: string } | null;
  items: ItemSnapshot[];
};

const money = (value: number) => Math.round(value * 100) / 100;
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;

/** Analytics only: never changes checkout totals, stock or the payment state. */
export function buildPaidPurchaseEvent(order: PurchaseSnapshot): Parameters<typeof purchaseEvent>[0] | null {
  if (order.paymentStatus !== 'paid' || ['cancelled', 'refunded'].includes(order.status) || typeof order.orderNumber !== 'string' || !order.orderNumber.trim()) return null;
  if (![order.subtotal, order.discountTotal, order.shippingFee, order.taxAmount ?? 0].every(nonnegative) || order.discountTotal > order.subtotal || !Array.isArray(order.items) || !order.items.length) return null;
  if (order.items.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0 || !nonnegative(item.itemSubtotal) || !nonnegative(item.priceAtPurchase) || !nonnegative(item.discountAmount ?? 0) || (item.discountAmount ?? 0) > item.itemSubtotal)) return null;

  const value = money(order.subtotal - order.discountTotal);
  const gross = order.items.reduce((sum, item) => sum + item.itemSubtotal, 0);
  if (!Number.isFinite(gross) || money(gross) !== money(order.subtotal) || (gross === 0 && value !== 0)) return null;
  const snapshotNet = order.items.reduce((sum, item) => sum + item.itemSubtotal - (item.discountAmount ?? 0), 0);
  const hasAllocatedDiscount = money(snapshotNet) === value;

  return {
    transaction_id: order.orderNumber,
    value,
    currency: order.currency || 'NGN',
    shipping: order.shippingFee,
    tax: order.taxAmount ?? 0,
    coupon: order.coupon?.code,
    items: order.items.map(item => {
      // Current orders have server-allocated coupon snapshots. Legacy orders
      // without them apportion the recorded merchandise discount for reporting.
      const lineValue = hasAllocatedDiscount
        ? item.itemSubtotal - (item.discountAmount ?? 0)
        : gross ? item.itemSubtotal * value / gross : 0;
      return {
        item_id: item.subproduct?.sku || item.product?.slug || undefined,
        item_name: item.product?.name || 'Product',
        item_variant: item.size?.name,
        price: lineValue / item.quantity,
        discount: (item.itemSubtotal - lineValue) / item.quantity,
        quantity: item.quantity,
      };
    }),
  };
}
