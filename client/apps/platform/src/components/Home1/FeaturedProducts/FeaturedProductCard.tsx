"use client";

import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  index,
  inCart,
  cartQty,
  inWishlist,
  addingToCart,
  wishlistAdding,
  onAddToCart,
  onRemoveFromCart,
  onWishlistToggle,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(
    product.sizes?.[0] ?? null,
  );

  // Price tracks the selected size so switching a size chip updates both the
  // displayed price and what actually gets added to the cart.
  const { price, originPrice } = priceForSize(selectedSize, product.price);
  const soldOut = product.totalStock <= 0 || isSizeOutOfStock(selectedSize);

  return (
    <motion.article
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={prefersReducedMotion ? undefined : { y: -6 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-500 hover:border-amber-300 hover:shadow-[0_20px_40px_-16px_rgba(180,120,20,0.35)]"
    >
      {/* Gold ring glow on hover */}
      <div className="pointer-events-none absolute inset-0 z-30 rounded-2xl ring-1 ring-amber-300/0 transition-all duration-500 group-hover:ring-amber-300/60" />

      <FeaturedProductImage
        product={product}
        isHovered={isHovered}
        onHoverChange={setIsHovered}
        soldOut={soldOut}
        inWishlist={inWishlist}
        inCart={inCart}
        addingToCart={addingToCart}
        wishlistAdding={wishlistAdding}
        onAddToCart={() => onAddToCart(selectedSize ?? undefined)}
        onRemoveFromCart={onRemoveFromCart}
        onWishlistToggle={onWishlistToggle}
      />

      <FeaturedProductInfo
        product={product}
        price={price}
        originPrice={originPrice}
        selectedSize={selectedSize}
        onSelectSize={setSelectedSize}
        inCart={inCart}
        cartQty={cartQty}
      />
    </motion.article>
  );
};

export default React.memo(FeaturedProductCard);