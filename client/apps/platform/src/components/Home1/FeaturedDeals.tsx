"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useModalQuickviewContext } from "@/context/ModalQuickviewContext";
import { StockStatus } from "@/components/StockStatus";
import * as Icon from "react-icons/pi";

interface ProductSize {
  _id?: string;
  size: string;
  volumeMl?: number;
  pricing?: { websitePrice?: number; originalWebsitePrice?: number };
  price?: number;
  stock?: number;
  inStock?: boolean;
  availableAtIndex?: number;
  salePrice?: number;
}

interface DealProduct {
  _id: string;
  name: string;
  slug: string;
  images?: Array<{ url: string }>;
  primaryImage?: { url: string };
  priceRange?: { min: number; max: number };
  salePrice?: number;
  discount?: number;
  rating?: number;
  reviewCount?: number;
  soldQuantity?: number;
  sizes?: ProductSize[];
  availableAt?: Array<{
    _id?: string;
    tenant?: { _id?: string; name?: string };
    sizes?: ProductSize[];
    salePrice?: number;
    saleDiscountValue?: number;
    saleType?: string;
    isOnSale?: boolean;
    saleEndDate?: string;
    pricing?: { websitePrice?: number; originalWebsitePrice?: number };
  }>;
}

interface FeaturedDealsProps {
  title?: string;
  subtitle?: string;
  limit?: number;
}

const TemuProductCard = ({
  product,
  onQuickView,
}: {
  product: DealProduct;
  onQuickView: (product: DealProduct) => void;
}) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const imageUrl = product.primaryImage?.url || product.images?.[0]?.url || "";

  const allAvailableAt = product.availableAt || [];
  const firstAvailableAt = allAvailableAt[0];
  const firstSize = firstAvailableAt?.sizes?.[0];
  const sizeDiscount = firstSize?.discount || firstAvailableAt?.discount || {};
  const sizePricing = firstSize?.pricing || {};

  // Use server-computed values directly
  const currentPrice = sizePricing.websitePrice || product.priceRange?.min || 0;
  const originalPrice = sizePricing.originalWebsitePrice || currentPrice;

  const hasDiscount = sizeDiscount.hasDiscount || (originalPrice > currentPrice && currentPrice > 0);
  const saleType = firstAvailableAt?.saleType || sizeDiscount.type || 'percentage';
  const isFlashSale = saleType === 'flash_sale';
  const isFixed = saleType === 'fixed';
  const fixedAmountOff = sizeDiscount.savings || (hasDiscount ? Math.round(originalPrice - currentPrice) : 0);
  const discountPercent = sizeDiscount.percentage || (hasDiscount ? Math.round((1 - currentPrice / originalPrice) * 100) : 0);

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm"
    >
      <Link href={`/product/${product.slug}`} className="block">
        {/* Image Container */}
        <div className="relative aspect-square bg-gray-50">
          {!imageError && imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-contain transition-transform duration-300"
              style={{ transform: isHovered ? "scale(1.05)" : "scale(1)" }}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
              <span className="text-5xl opacity-40">🍹</span>
            </div>
          )}

          {/* Discount Badge */}
          {hasDiscount && (
            <div className="absolute top-0 left-0">
              <div className={`text-white text-[10px] font-bold px-2 py-1 rounded-br-lg flex items-center gap-1 ${
                isFlashSale 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                  : isFixed 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                    : 'bg-gradient-to-r from-red-500 to-pink-500'
              }`}>
                {isFlashSale && <Icon.PiLightningFill size={8} />}
                {isFixed
                  ? `₦${fixedAmountOff.toLocaleString()}`
                  : `${discountPercent}% OFF`}
              </div>
            </div>
          )}

        </div>

        {/* Product Info */}
        <div className="p-2">
          <h3 className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight min-h-[2rem]">
            {product.name}
          </h3>

          {/* Star Rating */}
          <div className="flex items-center gap-1 mt-1">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon.PiStarFill
                  key={star}
                  size={8}
                  className={
                    star <= (product.rating || 4.5)
                      ? "text-amber-400"
                      : "text-gray-200"
                  }
                />
              ))}
            </div>
            <span className="text-[9px] text-gray-500">
              {product.reviewCount || 0}
            </span>
          </div>

          {/* Stock Status */}
          <div className="mt-1">
            <StockStatus stock={firstSize?.stock} showProgress />
          </div>

          {/* Price and Add to Cart - Inline */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-sm font-bold text-red-500">
                  ₦{currentPrice.toLocaleString()}
                </span>
                {hasDiscount && (
                  <span className="text-[10px] text-gray-400 line-through">
                    ₦{originalPrice.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickView(product);
              }}
              className="w-8 h-8 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center flex-shrink-0"
            >
              <Icon.PiShoppingCartSimple size={16} />
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

// In-memory cache: 60 seconds TTL
const _dealsCache = new Map<number, { data: DealProduct[]; ts: number }>();
const DEALS_CACHE_TTL = 60_000;

const FeaturedDeals: React.FC<FeaturedDealsProps> = ({
  title = "Just For You",
  subtitle = "",
  limit = 12,
}) => {
  const [products, setProducts] = useState<DealProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { openQuickview } = useModalQuickviewContext() || {};

  useEffect(() => {
    const fetchProducts = async () => {
      const cached = _dealsCache.get(limit);
      if (cached && Date.now() - cached.ts < DEALS_CACHE_TTL) {
        setProducts(cached.data);
        setLoading(false);
        return;
      }
      try {
        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        const res = await fetch(`${API_URL}/api/products?limit=${limit}`);
        const data = await res.json();
        let prods: DealProduct[] = [];
        if (data.success && data.data?.products) {
          prods = data.data.products;
        } else if (Array.isArray(data.products)) {
          prods = data.products;
        } else if (Array.isArray(data)) {
          prods = data;
        }
        _dealsCache.set(limit, { data: prods, ts: Date.now() });
        setProducts(prods);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [limit]);

  const handleQuickView = useCallback(
    (product: DealProduct) => {
      if (openQuickview) {
        openQuickview(product as any);
      }
    },
    [openQuickview],
  );

  if (loading) {
    return (
      <div className="px-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[...Array(limit)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-200 rounded-xl aspect-square animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-3 mb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <Link
          href="/shop"
          className="text-xs text-orange-500 font-medium flex items-center gap-0.5"
        >
          More <Icon.PiCaretRightBold size={12} />
        </Link>
      </div>

      {/* Products Grid - 2 columns on mobile, 3 on tablet, 4 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 px-3">
        {products.slice(0, limit).map((product) => (
          <TemuProductCard
            key={product._id}
            product={product}
            onQuickView={handleQuickView}
          />
        ))}
      </div>

      {/* View All Button */}
      <div className="mt-4 px-3">
        <Link
          href="/shop"
          className="block w-full py-3 text-center text-sm font-semibold text-orange-500 bg-white border-2 border-orange-500 rounded-xl hover:bg-orange-50 transition-colors"
        >
          See All
        </Link>
      </div>
    </div>
  );
};

export default FeaturedDeals;
