"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PiStarFill,
  PiShoppingCart,
  PiStorefront,
} from "react-icons/pi";
import type { Product, ProductSize } from "./types";

interface FeaturedProductInfoProps {
  product: Product;
  selectedSize: ProductSize | null;
  onSelectSize: (size: ProductSize) => void;
  inCart: boolean;
  cartQty: number;
}

const formatNaira = (value: number) => `₦${value.toLocaleString()}`;

const StockProgress: React.FC<{ sold: number; stock: number }> = ({ sold, stock }) => {
  if (stock <= 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">
          Out of stock
        </span>
      </div>
    );
  }
  const soldPct = Math.min(100, Math.max(0, Math.round((sold / stock) * 100)));
  const remaining = 100 - soldPct;
  let color = "bg-emerald-500";
  let label = "In stock";
  if (soldPct >= 90) { color = "bg-red-500"; label = "Almost gone"; }
  else if (soldPct >= 70) { color = "bg-orange-500"; label = "Selling fast"; }
  else if (soldPct >= 50) { color = "bg-yellow-500"; label = "Limited"; }

  return (
    <div className="flex items-center gap-2">
      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${color.replace("bg-", "text-").replace("-500", "-600")} bg-opacity-10`}>
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
  selectedSize,
  onSelectSize,
  inCart,
  cartQty,
}) => {
  return (
    <div className="flex flex-col gap-2 p-4">
      {/* Category eyebrow */}
      {product.category?.name && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
          {product.category.name}
        </span>
      )}

      {/* Name */}
      <Link href={`/product/${product.slug}`} className="group/name">
        <h3 className="min-h-[2.5rem] text-sm font-bold leading-snug text-gray-900 line-clamp-2 group-hover/name:text-amber-700">
          {product.name}
        </h3>
      </Link>

      {/* Rating + tenant count */}
      <div className="flex items-center gap-3">
        {product.averageRating > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <PiStarFill
                  key={i}
                  size={10}
                  className={i < Math.floor(product.averageRating) ? "text-amber-400" : "text-gray-200"}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-500">
              {product.averageRating.toFixed(1)} ({product.reviewCount})
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-gray-400">No ratings yet</span>
        )}
        {product.tenantCount > 1 && (
          <span className="flex items-center gap-1 text-[10px] text-violet-600">
            <PiStorefront size={11} />
            {product.tenantCount} tenants
          </span>
        )}
      </div>

      {/* Price */}
      <div className="flex items-end gap-2">
        <span className="text-lg font-black text-gray-900">
          {formatNaira(product.price)}
        </span>
        {product.sale && product.originPrice > product.price && (
          <>
            <span className="text-xs text-gray-400 line-through">
              {formatNaira(product.originPrice)}
            </span>
            <span className="ml-auto rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
              -{product.discount}%
            </span>
          </>
        )}
      </div>

      {/* Size chips */}
      {product.sizes && product.sizes.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {product.sizes.slice(0, 4).map((size) => (
            <button
              key={size._id}
              onClick={() => onSelectSize(size)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-all ${
                selectedSize?._id === size._id
                  ? "bg-gray-900 text-amber-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {size.size}
            </button>
          ))}
          {product.sizes.length > 4 && (
            <span className="px-2 py-0.5 text-[10px] text-gray-400">
              +{product.sizes.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Stock progress */}
      <StockProgress sold={product.totalSold} stock={product.totalStock} />

      {/* In-cart indicator */}
      {inCart && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
        >
          <PiShoppingCart size={14} />
          {cartQty} in cart
        </motion.div>
      )}
    </div>
  );
};

export default FeaturedProductInfo;