'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  PiPackage,
  PiPlus,
  PiMinus,
  PiTrash,
  PiArrowSquareOut,
  PiCheck,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import {
  effectiveSizePrice,
  effectiveSizelessPrice,
  sizeSelection,
  sizelessSelection,
  type CatalogProduct,
} from './sales-catalog-pricing';
import type { ProductLineSelection } from './product-line-search';
export type { CatalogProduct, CatalogSize } from './sales-catalog-pricing';

export interface SalesCatalogCardProps {
  product: CatalogProduct;
  pricelist?: unknown;
  currency?: string;
  quantity?: number;
  sizeQuantities?: Record<string, number>;
  onAdd: (selection: ProductLineSelection) => void;
  onSetQty: (selection: ProductLineSelection, quantity: number) => void;
  onRemove: (selection: ProductLineSelection) => void;
}

function Quantity({
  name,
  qty,
  onChange,
  onRemove,
}: {
  name: string;
  qty: number;
  onChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const button =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-30';
  return (
    <div className="flex items-center gap-1">
      <div className="flex min-w-0 items-center rounded-lg border border-gray-200 bg-white">
        <button
          type="button"
          className={button}
          disabled={qty <= 1}
          aria-label={`Decrease ${name}`}
          onClick={() => onChange(qty - 1)}
        >
          <PiMinus />
        </button>
        <input
          aria-label={`Quantity for ${name}`}
          inputMode="numeric"
          type="number"
          min="1"
          step="1"
          value={qty}
          className="w-11 border-0 bg-transparent p-0 text-center text-sm font-semibold focus:ring-0"
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value) && value >= 1)
              onChange(Math.floor(value));
          }}
        />
        <button
          type="button"
          className={button}
          aria-label={`Increase ${name}`}
          onClick={() => onChange(qty + 1)}
        >
          <PiPlus />
        </button>
      </div>
      <button
        type="button"
        className={`${button} text-gray-400 hover:text-red-600`}
        aria-label={`Remove ${name} from order`}
        onClick={onRemove}
      >
        <PiTrash />
      </button>
    </div>
  );
}

export default function SalesCatalogCard({
  product,
  pricelist,
  currency = 'NGN',
  quantity = 0,
  sizeQuantities = {},
  onAdd,
  onSetQty,
  onRemove,
}: SalesCatalogCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const hasSizes = !product.sellWithoutSizeVariants && product.sizes.length > 0;
  const stock =
    product.availableStock ??
    product.totalStock ??
    product.sizes.reduce((n, size) => n + (size.availableStock ?? 0), 0);
  const selected = hasSizes
    ? product.sizes.reduce((n, size) => n + (sizeQuantities[size.size] || 0), 0)
    : quantity;
  const prices = useMemo(
    () =>
      hasSizes
        ? product.sizes.map((size) =>
            effectiveSizePrice(
              product,
              size,
              pricelist,
              sizeQuantities[size.size] || 1
            )
          )
        : [effectiveSizelessPrice(product, pricelist, quantity || 1)],
    [product, pricelist, hasSizes, quantity, sizeQuantities]
  );
  const from = Math.min(...prices);
  const selection = sizelessSelection(product, pricelist, quantity || 1);
  return (
    <article
      aria-label={product.name}
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-sm ${selected ? 'border-brand/50 ring-1 ring-brand/10' : 'border-gray-200'}`}
    >
      <div className="relative flex h-52 items-center justify-center bg-gray-50/70 sm:h-56">
        {product.image && !imageFailed ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="266px"
            className="object-contain p-2"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <PiPackage className="h-12 w-12 text-gray-300" />
        )}
        <span
          className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[11px] font-semibold ${stock > 0 ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white text-gray-500'}`}
        >
          {stock > 0 ? `${stock} available` : 'Out of stock'}
        </span>
        {selected > 0 && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white">
            <PiCheck /> {selected} in order
          </span>
        )}
        {product.isAlcoholic && (
          <span className="absolute bottom-2 right-2 rounded bg-white/90 px-1.5 py-1 text-[10px] text-gray-600">
            {product.abv ?? 0}% ABV · 18+
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-gray-900">
            {product.name}
          </h3>
          <a
            href={routes.eCommerce.editSubProduct(product._id)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${product.name} details`}
            className="shrink-0 p-1 text-gray-400 hover:text-brand"
          >
            <PiArrowSquareOut />
          </a>
        </div>
        <p className="mt-1 truncate text-xs text-gray-500">
          {product.brand || product.category || 'Beverage'}
          {product.sku ? ` · ${product.sku}` : ''}
        </p>
        <div className="mt-auto pt-3">
          <p className="mb-3 text-base font-bold text-gray-900">
            {hasSizes && (
              <span className="mr-1 text-xs font-normal text-gray-500">
                From
              </span>
            )}
            {fmtCur(from, currency)}
          </p>
          {!hasSizes &&
            (quantity > 0 ? (
              <Quantity
                name={product.name}
                qty={quantity}
                onChange={(qty) => onSetQty(selection, qty)}
                onRemove={() => onRemove(selection)}
              />
            ) : (
              <button
                type="button"
                onClick={() => onAdd(selection)}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-gray-100 disabled:text-gray-400"
              >
                <PiPlus /> Add to order
              </button>
            ))}
          {hasSizes && (
            <>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
                className="min-h-10 w-full rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:border-brand hover:text-brand"
              >
                {expanded
                  ? 'Hide sizes'
                  : `Choose size · ${product.sizes.length}`}
              </button>
              {expanded && (
                <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                  {product.sizes.map((size, index) => {
                    const selectedSize = sizeSelection(
                      product,
                      size,
                      pricelist,
                      sizeQuantities[size.size] || 1
                    );
                    const qty = sizeQuantities[size.size] || 0;
                    const name = `${product.name} ${size.displayName || size.size}`;
                    return (
                      <div key={size.size} className="space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-1 text-xs">
                          <span className="font-semibold text-gray-800">
                            {size.displayName || size.size}
                          </span>
                          <span className="text-gray-500">
                            {size.availableStock ?? 0} available
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">
                          {fmtCur(prices[index], currency)}
                          {(size.unitsPerPack || 1) > 1 && (
                            <span className="ml-1 text-[11px] font-normal text-gray-500">
                              · {size.unitsPerPack} / pack
                            </span>
                          )}
                        </p>
                        {qty > 0 ? (
                          <Quantity
                            name={name}
                            qty={qty}
                            onChange={(value) => onSetQty(selectedSize, value)}
                            onRemove={() => onRemove(selectedSize)}
                          />
                        ) : (
                          <button
                            type="button"
                            aria-label={`Add ${name}`}
                            onClick={() => onAdd(selectedSize)}
                            className="min-h-9 w-full rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white hover:bg-brand disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            Add size
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
