"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
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
  const [isHovered, setIsHovered] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(
    product.sizes?.[0] ?? null,
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6 }}
      className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-500 hover:shadow-2xl hover:border-amber-300"
    >
      {/* Gold ring glow on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-amber-300/0 transition-all duration-500 group-hover:ring-amber-300/60" />

      <FeaturedProductImage
        product={product}
        isHovered={isHovered}
        onHoverChange={setIsHovered}
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
        selectedSize={selectedSize}
        onSelectSize={setSelectedSize}
        inCart={inCart}
        cartQty={cartQty}
      />
    </motion.article>
  );
};

export default React.memo(FeaturedProductCard);