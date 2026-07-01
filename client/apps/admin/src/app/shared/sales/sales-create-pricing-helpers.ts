// client/apps/admin/src/app/shared/sales/sales-create-pricing-helpers.ts

import type { POSCartItem, POSBundleDeal } from '@/app/shared/point-of-sale/types';
import { getEffectiveBundlePriceForItem } from '@/app/shared/point-of-sale/store';
import type { SalesLineItem } from '@/services/salesOrder.service';
import type { DraftLine } from './sales-line-table';

/**
 * Map a stored SalesOrder line into an editable draft line. Catalog metadata
 * the server doesn't echo back (sizeName, costPrice, availableStock, bundles,
 * originalPrice) starts empty — hydrateLineMeta in useSalesCreateForm fills it
 * afterwards so pricelist/bundle math and stock badges keep working.
 */
export function soItemToDraftLine(it: SalesLineItem): DraftLine {
  return {
    key: it._id,
    lineType: (it.lineType ?? 'product') as DraftLine['lineType'],
    subProductId: it.subproduct ?? '',
    product: it.product,
    name: it.name ?? '',
    sku: it.sku ?? '',
    sizeId: it.size,
    sizeName: undefined,
    quantity: it.quantity,
    baseUnitPrice: it.unitPrice,
    discount: it.discount,
    discountType: (it.discountType ?? 'fixed') as DraftLine['discountType'],
    taxRate: it.taxRate ?? 0,
    costPrice: 0,
    priceOverridden: !!it.priceOverridden,
    description: it.description ?? '',
  };
}

/** Create a blank draft line with defaults. */
export function blankLine(lineType: DraftLine['lineType'] = 'product'): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    lineType,
    subProductId: '',
    name: '',
    sku: '',
    quantity: 1,
    baseUnitPrice: 0,
    discount: 0,
    discountType: 'fixed',
    taxRate: 0,
    costPrice: 0,
    priceOverridden: false,
    description: '',
  };
}

/**
 * Live unit price after pricelist + bundle rules, unless the operator overrode it.
 * Section/note lines carry no price.
 */
export function liveUnitPrice(line: DraftLine, pricelist: unknown): number {
  if (line.lineType !== 'product') return 0;
  if (line.priceOverridden) return line.baseUnitPrice;
  if (!line.subProductId || !pricelist) return line.baseUnitPrice;
  const pricingItem: POSCartItem = {
    subProductId: line.subProductId,
    productId: line.product ?? line.subProductId,
    sizeId: line.sizeId,
    name: line.name,
    variant: line.sizeName ?? '',
    sku: line.sku,
    price: line.baseUnitPrice,
    quantity: line.quantity,
    discount: 0,
    stock: 0,
    costPrice: line.costPrice,
    activeBundles: line.activeBundles as POSBundleDeal[] | undefined,
    originalPrice: line.originalPrice,
  };
  return getEffectiveBundlePriceForItem(pricingItem, pricelist).price;
}

/**
 * Resolve a line's discount to an absolute amount off the WHOLE line total,
 * clamped so it can never exceed the line's gross. A percentage discount is a
 * percent of each unit (so it scales with quantity); a fixed discount is a flat
 * amount off the whole line, independent of quantity. Mirrors the backend's
 * lineDiscountOf so the client and server totals agree.
 */
export function resolveDiscount(unitPrice: number, line: DraftLine): number {
  const qty = Math.max(0, line.quantity || 0);
  const gross = unitPrice * qty;
  const raw = Math.max(0, line.discount || 0);
  if (line.discountType === 'percentage') {
    return Math.min(gross, Math.round((gross * Math.min(100, raw)) / 100));
  }
  return Math.min(gross, raw);
}

/** Compute the line total after discount. */
export function lineTotalOf(unitPrice: number, line: DraftLine): number {
  const qty = Math.max(0, line.quantity || 0);
  return Math.max(0, unitPrice * qty - resolveDiscount(unitPrice, line));
}
