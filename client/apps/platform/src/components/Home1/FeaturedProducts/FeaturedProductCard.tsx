"use client";

import React, { useState } from "react";
import type { Product, ProductSize } from "./types";
import FeaturedProductImage from "./FeaturedProductImage";
import FeaturedProductInfo from "./FeaturedProductInfo";

interface FeaturedProductCardProps {
  product: Product;
  index: number;
  inCart: boolean;
  cartQty: number;
  inWishlist: boolean;
  addingToCart: boolean;
  wishlistAdding: boolean;
  onAddToCart: (selectedSize?: ProductSize) => void;
  onRemoveFromCart: () => void;
  onWishlistToggle: () => void;
}

/** Resolve the live price for a size, falling back to the product's base price. */
const priceForSize = (
  size: ProductSize | null,
  fallback: number,
): { price: number; originPrice: number } => {
  const website = size?.pricing?.websitePrice;
  const original = size?.pricing?.originalWebsitePrice;
  return {
    price: website && website > 0 ? website : fallback,
    originPrice: original && original > 0 ? original : (website ?? fallback),
  };
};

const isSizeOutOfStock = (size: ProductSize | null): boolean =>
  size ? size.inStock === false || (typeof size.stock === "number" && size.stock <= 0) : false;

const FeaturedProductCard: React.FC<FeaturedProductCardProps> = ({
  product,
  inCart,
  cartQty,
  inWishlist,
  addingToCart,
  wishlistAdding,
  onAddToCart,
  onRemoveFromCart,
  onWishlistToggle,
}) => {
  const selectedSize = product.sizes?.[0] ?? null;
  const { price, originPrice } = priceForSize(selectedSize, product.price);
  const soldOut = product.totalStock <= 0 || isSizeOutOfStock(selectedSize);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      <FeaturedProductImage
        product={product}
        soldOut={soldOut}
        inWishlist={inWishlist}
        wishlistAdding={wishlistAdding}
        onWishlistToggle={onWishlistToggle}
      />

      <FeaturedProductInfo
        product={product}
        price={price}
        originPrice={originPrice}
        soldOut={soldOut}
        inCart={inCart}
        cartQty={cartQty}
        addingToCart={addingToCart}
        onAddToCart={() => onAddToCart(selectedSize ?? undefined)}
        onRemoveFromCart={onRemoveFromCart}
      />
    </div>
  );
};

export default React.memo(FeaturedProductCard);
