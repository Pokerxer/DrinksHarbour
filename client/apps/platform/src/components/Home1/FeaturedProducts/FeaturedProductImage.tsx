"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  PiHeart,
  PiHeartFill,
  PiShoppingCartSimple,
  PiTrash,
  PiSpinner,
  PiImageBroken,
  PiCrownSimpleFill,
} from "react-icons/pi";
import type { Product } from "./types";
import { AgeGateChip } from "@/components/beverage";

interface FeaturedProductImageProps {
  product: Product;
  isHovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  soldOut: boolean;
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
  soldOut,
  inWishlist,
  inCart,
  addingToCart,
  wishlistAdding,
  onAddToCart,
  onRemoveFromCart,
  onWishlistToggle,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [imgError, setImgError] = useState(false);

  const mainImage = product.thumbImage?.[0] || product.primaryImage?.url;
  const secondImage = product.thumbImage?.[1];
  const hasSecondImage = !!secondImage;
  const showSecond = hasSecondImage && isHovered && !prefersReducedMotion;

  return (
    <div
      className="relative aspect-[4/5] overflow-hidden bg-gradient-to-b from-amber-50/50 via-white to-gray-100/70"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {/* Soft radial spotlight behind the bottle */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(255,255,255,0.9),transparent_70%)]" />

      {/* Bottle — object-contain so tall spirits are never cropped */}
      <Link
        href={`/product/${product.slug}`}
        className="relative block h-full w-full"
        aria-label={product.name}
      >
        {!imgError && mainImage ? (
          <>
            <img
              src={mainImage}
              alt={product.name}
              loading="lazy"
              className={`absolute inset-0 h-full w-full object-contain p-5 drop-shadow-[0_12px_20px_rgba(0,0,0,0.18)] transition-all duration-700 ease-out ${
                showSecond ? "scale-95 opacity-0" : "scale-100 opacity-100 group-hover:scale-[1.05]"
              } ${soldOut ? "opacity-40 grayscale" : ""}`}
              onError={() => setImgError(true)}
            />
            {hasSecondImage && secondImage && (
              <img
                src={secondImage}
                alt=""
                aria-hidden
                loading="lazy"
                className={`absolute inset-0 h-full w-full object-contain p-5 drop-shadow-[0_12px_20px_rgba(0,0,0,0.18)] transition-all duration-700 ease-out ${
                  showSecond ? "scale-[1.05] opacity-100" : "scale-95 opacity-0"
                }`}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <PiImageBroken size={36} className="text-gray-300" />
          </div>
        )}
      </Link>

      {/* Featured ribbon (top-left) */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-900 shadow-md ring-1 ring-white/40">
        <PiCrownSimpleFill size={11} />
        Featured
      </div>

      {/* Status badges (stack under the ribbon) */}
      <div className="pointer-events-none absolute left-3 top-11 z-10 flex flex-col items-start gap-1.5">
        {product.isNew && (
          <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            New
          </span>
        )}
        {product.sale && product.discount > 0 && (
          <span className="rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            −{product.discount}%
          </span>
        )}
        {product.averageRating >= 4.5 && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-900 shadow-sm">
            Top rated
          </span>
        )}
      </div>

      {/* Age gate (top-right, above wishlist) */}
      <div className="absolute right-3 top-3 z-10">
        <AgeGateChip alcoholic={product.isAlcoholic} abv={product.abv} />
      </div>

      {/* Wishlist */}
      <motion.button
        whileHover={prefersReducedMotion ? undefined : { scale: 1.1 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onWishlistToggle();
        }}
        disabled={wishlistAdding}
        aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        className={`absolute right-3 top-11 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-md ring-1 ring-black/5 transition-colors ${
          wishlistAdding
            ? "bg-gray-400 text-white"
            : inWishlist
              ? "bg-rose-500 text-white"
              : "bg-white/90 text-gray-600 backdrop-blur-sm hover:bg-rose-50 hover:text-rose-500"
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

      {/* Sold-out veil */}
      {soldOut && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <span className="rounded-full bg-gray-900/85 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg">
            Sold out
          </span>
        </div>
      )}

      {/* Hover quick-add bar */}
      {!soldOut && (
        <motion.div
          initial={false}
          animate={{
            y: isHovered || prefersReducedMotion ? 0 : 64,
            opacity: isHovered || prefersReducedMotion ? 1 : 0,
          }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute inset-x-0 bottom-0 z-20 ${
            prefersReducedMotion ? "opacity-0 focus-within:opacity-100 hover:opacity-100" : ""
          }`}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (inCart) onRemoveFromCart();
              else onAddToCart();
            }}
            disabled={addingToCart}
            className={`flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              addingToCart
                ? "bg-amber-500 text-gray-900"
                : inCart
                  ? "bg-rose-500 text-white hover:bg-rose-600"
                  : "bg-gray-900 text-amber-300 hover:bg-gray-800"
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
                Remove
              </>
            ) : (
              <>
                <PiShoppingCartSimple size={14} />
                Quick add
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default FeaturedProductImage;
