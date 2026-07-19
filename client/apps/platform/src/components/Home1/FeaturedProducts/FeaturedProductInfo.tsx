"use client";

import React from "react";
import Link from "next/link";
import {
  PiStarFill,
  PiShoppingCartSimple,
  PiTrash,
  PiSpinner,
} from "react-icons/pi";
import { StockStatus } from "@/components/StockStatus";
import type { Product } from "./types";

interface FeaturedProductInfoProps {
  product: Product;
  price: number;
  originPrice: number;
  soldOut: boolean;
  inCart: boolean;
  cartQty: number;
  addingToCart: boolean;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
}

const formatNaira = (value: number) => `₦${Math.round(value).toLocaleString()}`;

const FeaturedProductInfo: React.FC<FeaturedProductInfoProps> = ({
  product,
  price,
  originPrice,
  soldOut,
  inCart,
  cartQty,
  addingToCart,
  onAddToCart,
  onRemoveFromCart,
}) => {
  const showCompare = product.sale && originPrice > price;
  const rating = product.averageRating || 0;

  return (
    <div className="p-2.5">
      {/* Name */}
      <Link href={`/product/${product.slug}`}>
        <h3 className="min-h-[2rem] text-xs font-medium leading-tight text-gray-800 line-clamp-2 hover:text-amber-700 sm:text-sm">
          {product.name}
        </h3>
      </Link>

      {/* Star rating */}
      <div
        className="mt-1.5 flex items-center gap-1"
        aria-label={`Rating: ${rating.toFixed(1)} out of 5, ${product.reviewCount} reviews`}
      >
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <PiStarFill
              key={star}
              size={8}
              className={star <= Math.round(rating || 4.5) ? "text-amber-400" : "text-gray-200"}
            />
          ))}
        </div>
        <span className="text-[10px] text-gray-500">({product.reviewCount})</span>
      </div>

      {/* Stock status */}
      <div className="mt-1.5">
        <StockStatus stock={product.totalStock} showProgress />
      </div>

      {/* Price + cart button */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-sm font-bold tabular-nums text-gray-900">
            {formatNaira(price)}
          </span>
          {showCompare && (
            <span className="text-[10px] tabular-nums text-gray-400 line-through">
              {formatNaira(originPrice)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (inCart) onRemoveFromCart();
            else onAddToCart();
          }}
          disabled={addingToCart || soldOut}
          aria-label={
            soldOut
              ? "Sold out"
              : inCart
                ? `Remove ${product.name} from cart`
                : `Add ${product.name} to cart`
          }
          className={`relative flex min-h-10 min-w-10 flex-shrink-0 items-center justify-center rounded-lg text-white transition-colors ${
            soldOut
              ? "cursor-not-allowed bg-gray-300"
              : addingToCart
                ? "bg-amber-500"
                : inCart
                  ? "bg-rose-500 hover:bg-rose-600"
                  : "bg-amber-500 hover:bg-amber-600"
          }`}
        >
          {addingToCart ? (
            <PiSpinner size={16} className="animate-spin" />
          ) : inCart ? (
            <PiTrash size={16} />
          ) : (
            <PiShoppingCartSimple size={16} />
          )}
          {inCart && cartQty > 0 && !addingToCart && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-900 px-1 text-[9px] font-bold text-amber-300">
              {cartQty}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default FeaturedProductInfo;
