// client/apps/admin/src/app/shared/sales/sales-catalog-card.tsx
'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  PiCheck,
  PiMinus,
  PiPlus,
  PiTrash,
  PiArrowSquareOut,
  PiWine,
  PiBeerBottle,
  PiDrop,
  PiPackage,
  PiSparkle,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import { getEffectiveBundlePriceForItem } from '@/app/shared/point-of-sale/store';
import type {
  POSCartItem,
  POSBundleDeal,
} from '@/app/shared/point-of-sale/types';
import type { ProductLineSelection } from './product-line-search';

/** Shape produced by the catalogue modal's mapProducts. */
export interface CatalogProduct {
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
  size: string;
  displayName?: string;
  sku?: string;
  sellingPrice: number;
  costPrice: number;
  availableStock?: number;
}

export interface SalesCatalogCardProps {
  product: CatalogProduct;
  /** Active pricelist for effective-price display (null = base price). */
  pricelist?: unknown;
  currency?: string;
  /** True for a short window after this card was added — shows a check mark. */
  justAdded?: boolean;
  /** Quantity of this (sizeless) product currently in the order; 0 = not added. */
  quantity?: number;
  /** Per-size quantity map: sizeId → qty in the order; absent/0 = not added. */
  sizeQuantities?: Record<string, number>;
  /** Add a line (qty 1). */
  onAdd: (selection: ProductLineSelection) => void;
  /** Set the quantity of an existing line. */
  onSetQty: (selection: ProductLineSelection, quantity: number) => void;
  /** Remove a line entirely. */
  onRemove: (selection: ProductLineSelection) => void;
}

function stockBadge(stock: number) {
  if (stock <= 0)
    return { label: 'Out of stock', cls: 'bg-red-50 text-red-600' };
  if (stock <= 10)
    return { label: `Low · ${stock}`, cls: 'bg-amber-50 text-amber-600' };
  return { label: 'In stock', cls: 'bg-emerald-50 text-emerald-600' };
}

/** Beverage-type-aware placeholder icon (mirrors the subproduct list card). */
function BeverageIcon({
  type,
  className,
}: {
  type?: string;
  className?: string;
}) {
  const t = (type || '').toLowerCase();
  if (t.includes('wine') || t.includes('champagne') || t.includes('prosecco'))
    return <PiWine className={className} />;
  if (
    t.includes('beer') ||
    t.includes('lager') ||
    t.includes('ale') ||
    t.includes('stout') ||
    t.includes('cider')
  )
    return <PiBeerBottle className={className} />;
  if (
    t.includes('water') ||
    t.includes('juice') ||
    t.includes('soft') ||
    t.includes('soda')
  )
    return <PiDrop className={className} />;
  if (
    t.includes('spirit') ||
    t.includes('whisk') ||
    t.includes('vodka') ||
    t.includes('gin')
  )
    return <PiSparkle className={className} />;
  return <PiPackage className={className} />;
}

/** Effective price for a sizeless product after pricelist/bundle rules. */
function effectiveSizelessPrice(p: CatalogProduct, pricelist: unknown): number {
  const item: POSCartItem = {
    subProductId: p._id,
    productId: p.productId ?? p._id,
    name: p.name,
    variant: '',
    sku: p.sku,
    price: p.baseSellingPrice,
    quantity: 1,
    discount: 0,
    stock: p.availableStock ?? p.totalStock ?? 0,
    costPrice: p.costPrice,
    activeBundles: p.bundleDeals,
    originalPrice: p.baseSellingPrice,
  };
  return getEffectiveBundlePriceForItem(item, pricelist).price;
}

/** Effective price for one size after pricelist/bundle rules. */
function effectiveSizePrice(
  p: CatalogProduct,
  s: CatalogSize,
  pricelist: unknown
): number {
  const item: POSCartItem = {
    subProductId: p._id,
    productId: p.productId ?? p._id,
    sizeId: s.size,
    name: p.name,
    variant: s.displayName ?? s.size,
    sku: s.sku ?? p.sku,
    price: s.sellingPrice || p.baseSellingPrice,
    quantity: 1,
    discount: 0,
    stock: s.availableStock ?? 0,
    costPrice: s.costPrice,
    activeBundles: p.bundleDeals,
    originalPrice: s.sellingPrice || p.baseSellingPrice,
  };
  return getEffectiveBundlePriceForItem(item, pricelist).price;
}

/** The selection for a sizeless add. */
function sizelessSelection(p: CatalogProduct): ProductLineSelection {
  return {
    name: p.name,
    sku: p.sku,
    subProductId: p._id,
    productId: p.productId,
    sellingPrice: effectiveSizelessPrice(p, undefined),
    costPrice: p.costPrice,
    taxRate: p.taxRate,
    availableStock: p.availableStock ?? p.totalStock ?? undefined,
    bundleDeals: p.bundleDeals,
    originalPrice: p.baseSellingPrice,
  };
}

/** The selection for a sized add. */
function sizeSelection(
  p: CatalogProduct,
  s: CatalogSize,
  pricelist: unknown
): ProductLineSelection {
  return {
    name: `${p.name} – ${s.displayName ?? s.size}`,
    sku: s.sku ?? p.sku,
    subProductId: p._id,
    productId: p.productId,
    sellingPrice: effectiveSizePrice(p, s, pricelist),
    costPrice: s.costPrice,
    taxRate: p.taxRate,
    sizeId: s.size,
    sizeName: s.displayName ?? s.size,
    availableStock: s.availableStock ?? undefined,
    bundleDeals: p.bundleDeals,
    originalPrice: s.sellingPrice || p.baseSellingPrice,
  };
}

/** A compact qty stepper + remove control shown once a line is in the order. */
function QtyControl({
  qty,
  onDec,
  onInc,
  onRemove,
  size,
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
  onRemove: () => void;
  size?: 'sm';
}) {
  const h = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  const iconH = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={onDec}
          className={`flex ${h} items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30`}
          disabled={qty <= 1}
          aria-label="Decrease quantity"
        >
          <PiMinus className={iconH} />
        </button>
        <span
          className={`text-center text-xs font-semibold text-gray-900 ${size === 'sm' ? 'w-5' : 'w-6'}`}
        >
          {qty}
        </span>
        <button
          type="button"
          onClick={onInc}
          className={`flex ${h} items-center justify-center text-gray-500 hover:bg-gray-50`}
          aria-label="Increase quantity"
        >
          <PiPlus className={iconH} />
        </button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className={`flex ${h} items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
        aria-label="Remove from order"
        title="Remove from order"
      >
        <PiTrash className={iconH} />
      </button>
    </div>
  );
}

/**
 * One product card in the Sales catalogue grid. Before a line is added, only an
 * "Add" button is shown (it adds 1). Once added, the Add button is replaced by
 * a quantity stepper + a remove button. Sized products show a size list where
 * each added size gets its own stepper + remove.
 */
export default function SalesCatalogCard({
  product,
  pricelist,
  currency = 'NGN',
  justAdded,
  quantity = 0,
  sizeQuantities = {},
  onAdd,
  onSetQty,
  onRemove,
}: SalesCatalogCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const hasSizes = !product.sellWithoutSizeVariants && product.sizes.length > 0;

  // Stock: sizeless → SubProduct.totalStock; sized → sum of size stock.
  const totalStock = hasSizes
    ? product.sizes.reduce((s, x) => s + (x.availableStock ?? 0), 0)
    : (product.availableStock ?? product.totalStock ?? 0);
  const badge = stockBadge(totalStock);

  // Effective "from" price (pricelist-aware). Guard against empty-size Infinity.
  const fromPrice = useMemo(() => {
    if (!hasSizes) return effectiveSizelessPrice(product, pricelist);
    const sizePrices = product.sizes
      .map((s) => effectiveSizePrice(product, s, pricelist))
      .filter((n) => n > 0);
    return sizePrices.length ? Math.min(...sizePrices) : 0;
  }, [product, pricelist, hasSizes]);

  const subHref = product._id
    ? routes.eCommerce.editSubProduct(product._id)
    : undefined;
  const outOfStock = totalStock <= 0;
  const showImg = product.image && !imgFailed;
  const inOrder = quantity > 0;

  function addSizeless() {
    onAdd(sizelessSelection(product));
  }
  function addSize(s: CatalogSize) {
    onAdd(sizeSelection(product, s, pricelist));
  }

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-xl border bg-white transition-all hover:shadow-md ${
        justAdded
          ? 'border-emerald-300 ring-1 ring-emerald-200'
          : 'border-gray-200'
      }`}
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
        {showImg ? (
          <Image
            src={product.image!}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BeverageIcon
              type={product.type}
              className="h-10 w-10 text-gray-200"
            />
          </div>
        )}

        {justAdded && (
          <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
            <PiCheck className="h-4 w-4" />
          </span>
        )}
        <span
          className={`absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
        >
          {badge.label}
        </span>
        {product.isAlcoholic && (
          <span
            title={`Alcoholic · ${product.abv ?? 0}% ABV`}
            className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600"
          >
            <PiWine className="h-3 w-3" /> {product.abv ?? 0}%
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-2.5">
        <div className="flex items-start justify-between gap-1">
          <p className="line-clamp-2 text-xs font-semibold text-gray-900">
            {product.name}
          </p>
          {subHref && (
            <Link
              href={subHref}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open subproduct"
              className="shrink-0 rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
            >
              <PiArrowSquareOut className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {product.sku && (
            <span className="font-mono text-[10px] text-gray-400">
              {product.sku}
            </span>
          )}
          {product.brand && (
            <span className="truncate text-[10px] text-gray-500">
              {product.brand}
            </span>
          )}
        </div>

        <div className="mt-auto pt-2">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">
                {fromPrice > 0 ? fmtCur(fromPrice, currency) : '—'}
              </p>
              {hasSizes && (
                <p className="text-[10px] text-gray-400">
                  from {product.sizes.length} size
                  {product.sizes.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          {/* Sizeless action row */}
          {!hasSizes && (
            <div className="mt-2">
              {inOrder ? (
                <QtyControl
                  qty={quantity}
                  onDec={() =>
                    onSetQty(sizelessSelection(product), quantity - 1)
                  }
                  onInc={() =>
                    onSetQty(sizelessSelection(product), quantity + 1)
                  }
                  onRemove={() => onRemove(sizelessSelection(product))}
                />
              ) : (
                <button
                  type="button"
                  onClick={addSizeless}
                  disabled={outOfStock}
                  className="w-full rounded-lg bg-[#b20202] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#9a0101] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add
                </button>
              )}
            </div>
          )}

          {/* Sized action row */}
          {hasSizes && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                disabled={outOfStock}
                className="w-full rounded-lg bg-[#b20202] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#9a0101] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {expanded ? 'Hide sizes' : 'Choose size'}
              </button>

              {expanded && (
                <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
                  {product.sizes.map((s) => {
                    const sPrice = effectiveSizePrice(product, s, pricelist);
                    const sOut = (s.availableStock ?? 0) <= 0;
                    const sQty = sizeQuantities[s.size] ?? 0;
                    const sel = sizeSelection(product, s, pricelist);
                    return (
                      <div
                        key={s.size}
                        className="rounded-lg px-1.5 py-1.5 hover:bg-gray-50"
                      >
                        {/* Line 1: size name + available badge */}
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[11px] font-medium text-gray-800">
                            {s.displayName ?? s.size}
                          </p>
                          <span
                            className={`shrink-0 rounded px-1.5 py-px text-[9px] font-semibold ${
                              sOut
                                ? 'bg-red-50 text-red-600'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {s.availableStock ?? 0} avail
                          </span>
                        </div>
                        {/* Line 2: price */}
                        <p className="mt-0.5 text-[11px] font-bold text-gray-900">
                          {sPrice > 0 ? fmtCur(sPrice, currency) : '—'}
                        </p>
                        {/* Line 3: in-order quantity + actions */}
                        <div className="mt-1.5 flex items-center justify-end">
                          {sQty > 0 ? (
                            <div className="flex w-full items-center justify-between">
                              <span className="text-[10px] text-gray-500">
                                In order: {sQty}
                              </span>
                              <QtyControl
                                size="sm"
                                qty={sQty}
                                onDec={() => onSetQty(sel, sQty - 1)}
                                onInc={() => onSetQty(sel, sQty + 1)}
                                onRemove={() => onRemove(sel)}
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addSize(s)}
                              disabled={sOut}
                              className="shrink-0 rounded-lg bg-[#b20202] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#9a0101] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
