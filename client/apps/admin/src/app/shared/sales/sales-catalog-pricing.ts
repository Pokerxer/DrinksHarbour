import { getEffectiveBundlePriceForItem } from '@/app/shared/point-of-sale/store/cart-pricing';
import type {
  POSCartItem,
  POSBundleDeal,
} from '@/app/shared/point-of-sale/types';
import type { ProductLineSelection } from './product-line-search';

export type CatalogSalesPricing = { unitPrice: number; quantity: number };

export interface CatalogProduct {
  salesPricing?: CatalogSalesPricing;
  _id: string;
  productId?: string;
  name: string;
  sku: string;
  image?: string;
  /** Product type — drives the placeholder beverage icon when no image. */
  type?: string;
  brand?: string;
  brandId?: string;
  category?: string;
  categoryId?: string;
  isAlcoholic?: boolean;
  abv?: number;
  baseSellingPrice: number;
  costPrice: number;
  taxRate: number;
  /** Parent SubProduct stock (sizeless products). */
  totalStock?: number;
  availableStock?: number;
  sellWithoutSizeVariants: boolean;
  sizes: CatalogSize[];
  bundleDeals?: POSBundleDeal[];
}

export interface CatalogSize {
  salesPricing?: CatalogSalesPricing;
  size: string;
  displayName?: string;
  sku?: string;
  sellingPrice: number;
  costPrice: number;
  wholesalePrice?: number;
  availableStock?: number;
  unitsPerPack?: number;
}

/** Effective price for a sizeless product after pricelist/bundle rules. */
export function effectiveSizelessPrice(
  p: CatalogProduct,
  pricelist: unknown,
  quantity = 1
): number {
  if (p.salesPricing) return p.salesPricing.unitPrice;
  const item: POSCartItem = {
    subProductId: p._id,
    productId: p.productId ?? p._id,
    name: p.name,
    variant: '',
    sku: p.sku,
    price: p.baseSellingPrice,
    quantity: Math.max(1, quantity),
    discount: 0,
    stock: p.availableStock ?? p.totalStock ?? 0,
    costPrice: p.costPrice,
    activeBundles: p.bundleDeals,
    originalPrice: p.baseSellingPrice,
  };
  return getEffectiveBundlePriceForItem(item, pricelist).price;
}

/** Effective price for one size after pricelist/bundle rules. */
export function effectiveSizePrice(
  p: CatalogProduct,
  s: CatalogSize,
  pricelist: unknown,
  quantity = 1
): number {
  if (s.salesPricing) return s.salesPricing.unitPrice;
  const item: POSCartItem = {
    subProductId: p._id,
    productId: p.productId ?? p._id,
    sizeId: s.size,
    name: p.name,
    variant: s.displayName ?? s.size,
    sku: s.sku ?? p.sku,
    price: s.sellingPrice || p.baseSellingPrice,
    quantity: Math.max(1, quantity),
    discount: 0,
    stock: s.availableStock ?? 0,
    costPrice: s.costPrice,
    wholesalePrice: s.wholesalePrice,
    activeBundles: p.bundleDeals,
    originalPrice: s.sellingPrice || p.baseSellingPrice,
  };
  return getEffectiveBundlePriceForItem(item, pricelist).price;
}

/** The selection for a sizeless add. */
export function sizelessSelection(
  p: CatalogProduct,
  pricelist: unknown,
  quantity = 1
): ProductLineSelection {
  return {
    name: p.name,
    sku: p.sku,
    subProductId: p._id,
    productId: p.productId,
    sellingPrice: effectiveSizelessPrice(p, pricelist, quantity),
    enginePriced: !!p.salesPricing,
    costPrice: p.costPrice,
    taxRate: p.taxRate,
    availableStock: p.availableStock ?? p.totalStock ?? undefined,
    bundleDeals: p.bundleDeals,
    originalPrice: p.baseSellingPrice,
  };
}

/** The selection for a sized add. */
export function sizeSelection(
  p: CatalogProduct,
  s: CatalogSize,
  pricelist: unknown,
  quantity = 1
): ProductLineSelection {
  return {
    name: `${p.name} – ${s.displayName ?? s.size}`,
    sku: s.sku ?? p.sku,
    subProductId: p._id,
    productId: p.productId,
    sellingPrice: effectiveSizePrice(p, s, pricelist, quantity),
    enginePriced: !!s.salesPricing,
    costPrice: s.costPrice,
    wholesalePrice: s.wholesalePrice,
    taxRate: p.taxRate,
    unitsPerPack: s.unitsPerPack,
    sizeId: s.size,
    sizeName: s.displayName ?? s.size,
    availableStock: s.availableStock ?? undefined,
    bundleDeals: p.bundleDeals,
    originalPrice: s.sellingPrice || p.baseSellingPrice,
  };
}
