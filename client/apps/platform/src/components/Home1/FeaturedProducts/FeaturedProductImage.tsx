"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PiHeart,
  PiHeartFill,
  PiShoppingCartSimple,
  PiTrash,
  PiSpinner,
  PiStorefront,
  PiImageBroken,
} from "react-icons/pi";
import type { Product } from "./types";
import { ABVBadge, VolumeBadge, OriginBadge, AgeGateChip } from "@/components/beverage";

interface FeaturedProductImageProps {
  product: Product;
  isHovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  inWishlist: boolean;
  inCart: boolean;
  addingToCart: boolean;
  wishlistAdding: boolean;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
  onWishlistToggle: () => void;
}

const FeaturedProductImage: React.FC<FeaturedProductImageProps> = ({
  product,
  isHovered,
  onHoverChange,
  inWishlist,
  inCart,
  addingToCart,
  wishlistAdding,
  onAddToCart,
  onRemoveFromCart,
  onWishlistToggle,
}) => {
  const [imgError, setImgError] = useState(false);

  const mainImage = product.thumbImage?.[0] || product.primaryImage?.url;
  const secondImage = product.thumbImage?.[1];
  const hasSecondImage = !!secondImage;

  const tenant = product.availableAt?.[0]?.tenant;
  const tenantCount = product.tenantCount;

  return (
    <div
      className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {/* Image */}
      <Link href={`/product/${product.slug}`} className="block relative w-full h-full" aria-label={product.name}>
        {!imgError && mainImage ? (
          <>
            <img
              src={mainImage}
              alt={product.name}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${
                hasSecondImage && isHovered ? "scale-110 opacity-0" : "scale-100 opacity-100"
              }`}
              onError={() => setImgError(true)}
            />
            {hasSecondImage && secondImage && (
              <img
                src={secondImage}
                alt={`${product.name} alternate view`}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${
                  isHovered ? "scale-105 opacity-100" : "scale-100 opacity-0"
                }`}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <PiImageBroken size={36} className="text-gray-600" />
          </div>
        )}
        {/* Gradient wash for legibility of badges */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      </Link>

      {/* FEATURED ribbon (top-left) */}
      <div className="pointer-events-none absolute left-0 top-3 z-10">
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-900 shadow-lg">
          <span className="h-1 w-1 rounded-full bg-gray-900" />
          Featured
        </div>
      </div>

      {/* Badges column (top-right) */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
        {product.isNew && (
          <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
            NEW
          </span>
        )}
        {product.sale && product.discount > 0 && (
          <span className="rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
            -{product.discount}%
          </span>
        )}
        {product.averageRating >= 4.5 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-gray-900 shadow-lg">
            TOP
          </span>
        )}
        <AgeGateChip alcoholic={product.isAlcoholic} abv={product.abv} />
      </div>

      {/* Beverage metadata strip (bottom-left) */}
      <div className="absolute bottom-3 left-3 z-10 flex max-w-[70%] flex-col items-start gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <ABVBadge abv={product.abv} alcoholic={product.isAlcoholic} />
          <VolumeBadge volumeMl={product.volumeMl} />
          <OriginBadge origin={product.originCountry} />
        </div>
        {tenant && (
          <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-0.5 shadow-md backdrop-blur-sm">
            <PiStorefront size={11} className="text-gray-700" />
            <span className="truncate text-[10px] font-medium text-gray-700 max-w-[90px]">
              {tenant.name}
            </span>
            {tenantCount > 1 && (
              <span className="text-[10px] font-semibold text-violet-600">
                +{tenantCount - 1}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Wishlist button (top-right of action cluster) */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onWishlistToggle();
        }}
        disabled={wishlistAdding}
        aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        className={`absolute right-3 bottom-16 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-all ${
          wishlistAdding
            ? "bg-gray-500 text-white"
            : inWishlist
              ? "bg-red-500 text-white"
              : "bg-white/95 text-gray-700 hover:bg-red-50 hover:text-red-500"
        }`}
      >
        {wishlistAdding ? (
          <PiSpinner size={16} className="animate-spin" />
        ) : inWishlist ? (
          <PiHeartFill size={16} />
        ) : (
          <PiHeart size={16} />
        )}
      </motion.button>

      {/* Hover quick-add bar */}
      <motion.div
        initial={false}
        animate={{ y: isHovered ? 0 : 60, opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-0 left-0 right-0 z-20"
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (inCart) onRemoveFromCart();
            else onAddToCart();
          }}
          disabled={addingToCart}
          className={`flex w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
            addingToCart
              ? "bg-amber-500 text-gray-900"
              : inCart
                ? "bg-rose-500 text-white hover:bg-rose-600"
                : "bg-amber-400 text-gray-900 hover:bg-amber-300"
          }`}
        >
          {addingToCart ? (
            <>
              <PiSpinner size={14} className="animate-spin" />
              Adding…
            </>
          ) : inCart ? (
            <>
              <PiTrash size={14} />
              Remove from cart
            </>
          ) : (
            <>
              <PiShoppingCartSimple size={14} />
              Quick add
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
};

export default FeaturedProductImage;