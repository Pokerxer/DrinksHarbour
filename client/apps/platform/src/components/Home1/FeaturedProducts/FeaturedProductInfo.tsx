"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PiStarFill, PiShoppingCart, PiStorefront } from "react-icons/pi";
import type { Product, ProductSize } from "./types";
import { ABVBadge, VolumeBadge, OriginBadge } from "@/components/beverage";

interface FeaturedProductInfoProps {
  product: Product;
  price: number;
  originPrice: number;
  selectedSize: ProductSize | null;
  onSelectSize: (size: ProductSize) => void;
  inCart: boolean;
  cartQty: number;
}

const formatNaira = (value: number) => `₦${Math.round(value).toLocaleString()}`;

const sizeIsOut = (size: ProductSize): boolean =>
  size.inStock === false || (typeof size.stock === "number" && size.stock <= 0);

const StockProgress: React.FC<{ sold: number; stock: number }> = ({ sold, stock }) => {
  if (stock <= 0) {
    return (
      <span className="w-max rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
        Out of stock
      </span>
    );
  }
  const soldPct = Math.min(100, Math.max(0, Math.round((sold / stock) * 100)));
  const remaining = 100 - soldPct;
  let color = "bg-emerald-500";
  let text = "text-emerald-600";
  let label = "In stock";
  if (soldPct >= 90) { color = "bg-red-500"; text = "text-red-600"; label = "Almost gone"; }
  else if (soldPct >= 70) { color = "bg-orange-500"; text = "text-orange-600"; label = "Selling fast"; }
  else if (soldPct >= 50) { color = "bg-yellow-500"; text = "text-yellow-600"; label = "Limited"; }

  return (
    <div className="flex items-center gap-2">
      <span className={`flex items-center gap-1 text-[10px] font-semibold ${text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
        {label}
      </span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${remaining}%` }} />
      </div>
    </div>
  );
};

const FeaturedProductInfo: React.FC<FeaturedProductInfoProps> = ({
  product,
  price,
  originPrice,
  selectedSize,
  onSelectSize,
  inCart,
  cartQty,
}) => {
  const tenant = product.availableAt?.[0]?.tenant;
  const showCompare = product.sale && originPrice > price;

  return (
    <div className="flex flex-1 flex-col gap-2.5 p-4">
      {/* Category eyebrow */}
      {product.category?.name && (
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-600">
          {product.category.name}
        </span>
      )}

      {/* Name */}
      <Link href={`/product/${product.slug}`} className="group/name">
        <h3 className="min-h-[2.5rem] text-sm font-bold leading-snug text-gray-900 line-clamp-2 group-hover/name:text-amber-700">
          {product.name}
        </h3>
      </Link>

      {/* Beverage metadata */}
      {(product.abv != null || product.volumeMl != null || product.originCountry) && (
        <div className="flex flex-wrap gap-1.5">
          <ABVBadge abv={product.abv} alcoholic={product.isAlcoholic} />
          <VolumeBadge volumeMl={product.volumeMl} />
          <OriginBadge origin={product.originCountry} />
        </div>
      )}

      {/* Rating */}
      <div className="flex items-center gap-1.5">
        {product.averageRating > 0 ? (
          <>
            <div className="flex items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <PiStarFill
                  key={i}
                  size={11}
                  className={i < Math.round(product.averageRating) ? "text-amber-400" : "text-gray-200"}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-500">
              {product.averageRating.toFixed(1)} ({product.reviewCount})
            </span>
          </>
        ) : (
          <span className="text-[10px] text-gray-400">No ratings yet</span>
        )}
      </div>

      {/* Price */}
      <div className="flex items-end gap-2">
        <span className="text-lg font-black tabular-nums text-gray-900">
          {formatNaira(price)}
        </span>
        {showCompare && (
          <>
            <span className="pb-0.5 text-xs tabular-nums text-gray-400 line-through">
              {formatNaira(originPrice)}
            </span>
            <span className="ml-auto rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
              −{product.discount}%
            </span>
          </>
        )}
      </div>

      {/* Size chips — selecting one updates the price above */}
      {product.sizes && product.sizes.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {product.sizes.slice(0, 4).map((size) => {
            const out = sizeIsOut(size);
            const active = selectedSize?._id === size._id;
            return (
              <button
                key={size._id}
                onClick={() => !out && onSelectSize(size)}
                disabled={out}
                aria-pressed={active}
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all ${
                  out
                    ? "cursor-not-allowed bg-gray-50 text-gray-300 line-through"
                    : active
                      ? "bg-gray-900 text-amber-300 ring-1 ring-gray-900"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {size.size}
              </button>
            );
          })}
          {product.sizes.length > 4 && (
            <span className="px-1.5 py-0.5 text-[10px] text-gray-400">
              +{product.sizes.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Stock progress */}
      <StockProgress sold={product.totalSold} stock={product.totalStock} />

      {/* Vendor + multi-tenant availability */}
      {tenant && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <PiStorefront size={12} className="shrink-0 text-gray-400" />
          <span className="truncate">{tenant.name}</span>
          {product.tenantCount > 1 && (
            <span className="shrink-0 font-semibold text-amber-600">
              +{product.tenantCount - 1} more
            </span>
          )}
        </div>
      )}

      {/* In-cart indicator */}
      {inCart && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-auto flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
        >
          <PiShoppingCart size={14} />
          {cartQty} in cart
        </motion.div>
      )}
    </div>
  );
};

export default FeaturedProductInfo;
