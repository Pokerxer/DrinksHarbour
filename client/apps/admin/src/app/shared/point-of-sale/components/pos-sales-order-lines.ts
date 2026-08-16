// Turning a loaded Sales Order into cart lines.
//
// This is pure, and here rather than inline in `handleLoadOrder`, because the
// bug it exists to prevent is invisible in a rendered cart: the handler took
// `so: any` and read three field names the SalesOrder schema does not declare —
// `sizeId`, `sizeName`, `costPrice`, where the schema has `size` and neither of
// the others. TypeScript never looked, nothing threw, and every sized line
// loaded with no size and zero cost. See pos-sales-order-lines.test.ts.
//
// Admin vitest is `environment: 'node'` and cannot render the cart, so the only
// way to test this is to have it not be inside a component — the same reason
// pos-product-window.ts was extracted.

import type { POSCartItem, POSProduct } from '../types';
import { getImageUrl } from '../utils';

/** A Sales Order line, in the field names `models/SalesOrder.js` actually declares. */
export interface SalesOrderLine {
  _id?: string;
  lineType?: 'product' | 'section' | 'note';
  product?: string | null;
  subproduct?: string | null;
  size?: string | null;
  sku?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  discountType?: 'fixed' | 'percentage';
  promoDiscount?: number;
  taxRate?: number;
  fulfilledQty?: number;
}

/** The parts of a Sales Order the till reads. */
export interface LoadedSalesOrder {
  _id?: string;
  soNumber?: string;
  items?: SalesOrderLine[];
  /** A ref — an id when lean, a document when the endpoint populated it. */
  warehouseId?: string | { _id?: string; name?: string; code?: string } | null;
}

/**
 * The line's agreed price per unit, net of its discount and promotion.
 *
 * Mirrors `lineTotalOf` in server/services/salesOrder.service.js exactly,
 * including the rounding of a percentage discount, because the server charges
 * this number (createPOSOrder re-reads the Sales Order and prices the line from
 * it) and a cart that displayed anything else would be lying to the cashier.
 *
 * The discount is folded into the price rather than carried in the cart's own
 * discount field because that field is a percentage from the dialpad and cannot
 * express a flat ₦ off a whole line — and because per-unit is the only split of
 * a flat discount that stays right when only part of the line is sold.
 */
export function agreedUnitPrice(line: SalesOrderLine): number {
  const qty = Number(line.quantity) || 0;
  if (qty <= 0) return 0;

  const gross = (Number(line.unitPrice) || 0) * qty;
  const raw = Math.max(0, Number(line.discount) || 0);
  const discount =
    line.discountType === 'percentage'
      ? Math.min(gross, Math.round((gross * Math.min(100, raw)) / 100))
      : Math.min(gross, raw);

  const net = Math.max(0, gross - discount) - (Number(line.promoDiscount) || 0);
  return Math.max(0, net) / qty;
}

/**
 * The warehouse the order was quoted against.
 *
 * The POS list endpoint does `.populate('warehouseId', 'name code')`, so this is
 * a document as often as it is an id — and a document handed to `setWarehouseId`
 * stringifies to "[object Object]". Since `715862d7` the products endpoint
 * guards against exactly that and falls back to the shop's own warehouse, so
 * there was no crash: the quote's warehouse simply never applied and the cashier
 * sold another warehouse's stock without being told. A ref is an id even when
 * the server populates it.
 */
export function salesOrderWarehouseId(so: LoadedSalesOrder): string | undefined {
  const w = so?.warehouseId;
  if (!w) return undefined;
  if (typeof w === 'string') return w || undefined;
  return w._id ? String(w._id) : undefined;
}

/**
 * The cart lines a Sales Order loads as — the same shape the product grid
 * builds when a cashier taps a card, so a loaded line and a tapped line behave
 * identically from there on.
 *
 * Everything the SalesOrder line cannot know (cost, stock, image, size name)
 * comes from the POS catalogue, which the terminal already holds in full. A line
 * whose sub-product is missing from the catalogue still loads, carrying its own
 * name and the agreed price with a zero cost: refusing to load a quotation
 * because one product moved out of the POS is worse than loading it.
 *
 * Quantity is what is still OUTSTANDING, so re-loading a part-fulfilled order
 * does not re-sell the units already sold.
 */
export function salesOrderToCartItems(
  so: LoadedSalesOrder,
  catalogue: POSProduct[]
): POSCartItem[] {
  const bySubProduct = new Map((catalogue ?? []).map((p) => [String(p._id), p]));
  const out: POSCartItem[] = [];

  for (const line of so?.items ?? []) {
    if (line.lineType && line.lineType !== 'product') continue;
    if (!line.subproduct) continue;

    const outstanding =
      (Number(line.quantity) || 0) - (Number(line.fulfilledQty) || 0);
    if (outstanding <= 0) continue;

    const subProductId = String(line.subproduct);
    const product = bySubProduct.get(subProductId);
    const sizeId = line.size ? String(line.size) : undefined;
    const size = sizeId
      ? product?.sizes?.find((s) => String(s._id) === sizeId)
      : undefined;

    out.push({
      subProductId,
      productId: String(product?.product?._id ?? line.product ?? ''),
      sizeId,
      name: product?.product?.name || line.name || 'Product',
      variant: size?.displayName ?? '',
      sku: size?.sku || line.sku || product?.sku || '',
      image: product ? getImageUrl(product) : undefined,
      price: agreedUnitPrice(line),
      quantity: outstanding,
      // The agreed price already IS the negotiated discount; charging the
      // dialpad discount on top of it would give the deal away twice.
      discount: 0,
      stock: size?.availableStock ?? product?.availableStock ?? 0,
      costPrice: size?.costPrice ?? product?.costPrice ?? 0,
      originalPrice: product?.originalPrice ?? undefined,
      // Same reason as `discount`: a bundle deal must not re-price a quoted
      // line. The server refuses to as well (createPOSOrder).
      activeBundles: [],
    });
  }

  return out;
}
