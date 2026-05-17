'use client';

import { useState } from 'react';
import { POSProduct, POSSize } from '@/app/shared/point-of-sale/types';
import { getImageUrl, getProductDisplayName, formatCurrency } from '@/app/shared/point-of-sale/utils';
import Image from 'next/image';
import cn from '@core/utils/class-names';
import { PiPlus } from 'react-icons/pi';

type ProductCardProps = {
  product: POSProduct;
  onAddToCart: (product: POSProduct, sizeId?: string) => void;
  className?: string;
};

export default function POSProductCard({ product, onAddToCart, className }: ProductCardProps) {
  const hasSizes   = product.sizes?.length > 0 && !product.sellWithoutSizeVariants;
  const validSizes: POSSize[] = hasSizes ? product.sizes.filter(Boolean) : [];

  // Default to first in-stock size; fall back to first size
  const defaultSizeId = hasSizes
    ? (validSizes.find((s) => s.availableStock > 0)?._id ?? validSizes[0]?._id)
    : undefined;

  const [selectedSize, setSelectedSize] = useState<string | undefined>(defaultSizeId);

  const selectedSizeData = hasSizes && selectedSize
    ? validSizes.find((s) => s._id === selectedSize) ?? null
    : null;

  // Card is out-of-stock only when ALL sizes are OOS (or no sizes and product depleted)
  const allSizesOOS  = hasSizes && validSizes.every((s) => s.availableStock <= 0);
  const isOutOfStock = hasSizes
    ? allSizesOOS
    : (product.availableStock <= 0 || product.status === 'out_of_stock');

  // Selected size may itself be OOS while other sizes have stock
  const selectedSizeOOS = selectedSizeData ? selectedSizeData.availableStock <= 0 : false;

  // Low-stock uses selected size's count when available, otherwise product-level
  const stockCount = selectedSizeData?.availableStock ?? product.availableStock;
  const isLowStock = !isOutOfStock && !selectedSizeOOS && stockCount > 0 && stockCount <= 5;

  // Price: the server already bakes sale discounts into sellingPrice/baseSellingPrice
  const saleActive   = product.isOnSale;
  const displayPrice = selectedSizeData?.sellingPrice ?? product.baseSellingPrice;

  const vendorName = product.vendor
    ? (product.vendor.posName || `${product.vendor.firstName ?? ''} ${product.vendor.lastName ?? ''}`.trim()) || null
    : null;
  const imageUrl = getImageUrl(product);
  const name     = getProductDisplayName(product);
  const canAdd   = !isOutOfStock && !selectedSizeOOS;

  function handleCardClick() {
    if (!canAdd) return;
    if (hasSizes && selectedSize) onAddToCart(product, selectedSize);
    else if (!hasSizes) onAddToCart(product);
  }

  function handleSizePill(e: React.MouseEvent, sizeId: string) {
    e.stopPropagation();
    setSelectedSize(sizeId);
  }

  return (
    <button
      type="button"
      onClick={handleCardClick}
      disabled={isOutOfStock}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm',
        'transition-all duration-150 hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-lg',
        'active:scale-[0.97] active:shadow-sm',
        isOutOfStock && 'cursor-not-allowed opacity-70',
        className
      )}
    >
      {/* ── Image ── */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
            className={cn(
              'object-cover transition-transform duration-300 group-hover:scale-[1.04]',
              isOutOfStock && 'grayscale'
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl text-gray-200 select-none">
            &#127863;
          </div>
        )}

        {/* Sale badge */}
        {saleActive && (
          <span className="absolute left-2 top-2 rounded-full bg-[#b20202] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            Sale
          </span>
        )}

        {/* Low stock badge */}
        {isLowStock && (
          <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            {stockCount} left
          </span>
        )}

        {/* All-sizes out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-xl bg-white/95 px-3 py-1.5 text-xs font-bold text-gray-800 shadow-sm">
              Out of Stock
            </span>
          </div>
        )}

        {/* Selected size OOS but other sizes available */}
        {!isOutOfStock && selectedSizeOOS && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="rounded-xl bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm">
              Size unavailable — pick another
            </span>
          </div>
        )}

        {/* Hover add overlay */}
        {canAdd && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#b20202]/0 transition-all duration-200 group-hover:bg-[#b20202]/10">
            <span className="flex h-11 w-11 scale-0 items-center justify-center rounded-full bg-[#b20202] text-white shadow-lg transition-all duration-200 group-hover:scale-100 group-active:scale-90">
              <PiPlus className="h-5 w-5" />
            </span>
          </div>
        )}

        {/* Red bottom accent on hover */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 origin-center scale-x-0 bg-[#b20202] transition-transform duration-200 group-hover:scale-x-100" />
      </div>

      {/* ── Info ── */}
      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        {/* Brand / type + vendor */}
        <div className="mb-0.5 flex items-center justify-between gap-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {product.product?.brand?.name || product.product?.type || ' '}
          </p>
          {vendorName && (
            <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-500">
              {vendorName}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-gray-900">
          {name}
        </h3>

        {/* Size pills — span avoids nested <button> hydration error */}
        {hasSizes && (
          <div className="mt-2 flex flex-wrap gap-1">
            {validSizes.map((size) => {
              const sizeOOS    = size.availableStock <= 0;
              const isSelected = selectedSize === size._id;
              return (
                <span
                  key={size._id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleSizePill(e as unknown as React.MouseEvent, size._id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSizePill(e as unknown as React.MouseEvent, size._id)}
                  title={sizeOOS ? 'Out of stock' : formatCurrency(size.sellingPrice)}
                  className={cn(
                    'cursor-pointer rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors select-none',
                    sizeOOS && 'opacity-40 line-through',
                    isSelected
                      ? 'border-[#b20202] bg-[#b20202] text-white'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'
                  )}
                >
                  {size.displayName}
                </span>
              );
            })}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto flex items-baseline justify-between pt-2">
          <span className="text-base font-extrabold text-gray-900">
            {formatCurrency(displayPrice)}
          </span>
          {saleActive && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#b20202]">
              Sale
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
