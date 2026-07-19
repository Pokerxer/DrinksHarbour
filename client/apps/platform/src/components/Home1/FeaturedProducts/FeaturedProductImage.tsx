"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  PiHeart,
  PiHeartFill,
  PiSpinner,
  PiImageBroken,
  PiCrownSimpleFill,
} from "react-icons/pi";
import type { Product } from "./types";

interface FeaturedProductImageProps {
  product: Product;
  soldOut: boolean;
  inWishlist: boolean;
  wishlistAdding: boolean;
  onWishlistToggle: () => void;
}

const FeaturedProductImage: React.FC<FeaturedProductImageProps> = ({
  product,
  soldOut,
  inWishlist,
  wishlistAdding,
  onWishlistToggle,
}) => {
  const [imgError, setImgError] = useState(false);
  const imageUrl = product.thumbImage?.[0] || product.primaryImage?.url || "";

  return (
    <Link href={`/product/${product.slug}`} className="block">
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {!imgError && imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-contain p-2 motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-105 ${
              soldOut ? "opacity-40 grayscale" : ""
            }`}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
            <PiImageBroken size={40} className="text-gray-300" />
          </div>
        )}

        {/* Featured ribbon (top-left) */}
        <div className="pointer-events-none absolute left-0 top-0 flex items-center gap-1 rounded-br-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-900 shadow-sm">
          <PiCrownSimpleFill size={9} />
          Featured
        </div>

        {/* Discount badge (under ribbon) */}
        {product.sale && product.discount > 0 && (
          <div className="absolute left-0 top-7 rounded-br-lg bg-gradient-to-r from-red-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            {product.discount}% OFF
          </div>
        )}

        {/* Wishlist (top-right) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onWishlistToggle();
          }}
          disabled={wishlistAdding}
          aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 transition-colors ${
            wishlistAdding
              ? "bg-gray-400 text-white"
              : inWishlist
                ? "bg-rose-500 text-white"
                : "bg-white/90 text-gray-600 backdrop-blur-sm hover:bg-rose-50 hover:text-rose-500"
          }`}
        >
          {wishlistAdding ? (
            <PiSpinner size={14} className="animate-spin" />
          ) : inWishlist ? (
            <PiHeartFill size={14} />
          ) : (
            <PiHeart size={14} />
          )}
        </button>

        {/* Sold-out veil */}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-gray-900/85 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
              Sold out
            </span>
          </div>
        )}
      </div>
    </Link>
  );
};

export default FeaturedProductImage;
