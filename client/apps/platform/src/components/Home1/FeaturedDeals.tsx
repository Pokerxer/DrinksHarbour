"use client";

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useModalQuickviewContext } from "@/context/ModalQuickviewContext";
import { StockStatus } from "@/components/StockStatus";
import {
  PiLightningFill,
  PiStarFill,
  PiShoppingCartSimple,
  PiCaretRightBold,
  PiImageBroken,
} from "react-icons/pi";

interface SizeDiscount {
  type?: string;
  value?: number;
  percentage?: number;
  hasDiscount?: boolean;
  originalPrice?: number;
  savings?: number;
  source?: string;
  label?: string;
}

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
  discount?: SizeDiscount | null;
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
    discount?: SizeDiscount | null;
    pricing?: { websitePrice?: number; originalWebsitePrice?: number };
  }>;
}

interface FeaturedDealsProps {
  title?: string;
  subtitle?: string;
  limit?: number;
  // Products fetched on the server so the deal cards + /product links are in the
  // raw HTML (crawlable). Seeds state and skips the initial client fetch.
  initialProducts?: DealProduct[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Scan every tenant offer + size and pick the one carrying an active promotion.
// The backend attaches the discount object to the specific size on sale, which
// isn't necessarily availableAt[0].sizes[0]. Falling back to the first size (for
// the base price) means non-promoted products still render a plain price.
function resolveBestOffer(product: DealProduct) {
  const offers = product.availableAt || [];
  let bestSize: ProductSize | undefined;
  let bestOffer: (typeof offers)[number] | undefined;
  let bestSavings = -1;

  for (const offer of offers) {
    for (const size of offer.sizes || []) {
      const savings = size.discount?.hasDiscount ? size.discount?.savings ?? 0 : 0;
      if (savings > bestSavings) {
        bestSavings = savings;
        bestSize = size;
        bestOffer = offer;
      }
    }
  }

  // No discounted size found — default to the first available size for pricing.
  if (!bestSize) {
    bestOffer = offers[0];
    bestSize = bestOffer?.sizes?.[0];
  }

  return { offer: bestOffer, size: bestSize };
}

function calcPricing(product: DealProduct) {
  const { offer, size } = resolveBestOffer(product);
  const sizeDiscount: SizeDiscount = size?.discount || offer?.discount || {};
  const sizePricing = size?.pricing || {};

  const currentPrice = sizePricing.websitePrice || product.priceRange?.min || 0;
  const originalPrice = sizePricing.originalWebsitePrice || currentPrice;
  const hasDiscount =
    !!sizeDiscount.hasDiscount || (originalPrice > currentPrice && currentPrice > 0);
  const saleType = offer?.saleType || sizeDiscount.type || 'percentage';
  const isFlashSale = saleType === 'flash_sale';
  const isFixed = saleType === 'fixed';
  const fixedAmountOff =
    sizeDiscount.savings || (hasDiscount ? Math.round(originalPrice - currentPrice) : 0);
  const discountPercent =
    sizeDiscount.percentage ||
    (hasDiscount && originalPrice > 0
      ? Math.round((1 - currentPrice / originalPrice) * 100)
      : 0);

  return { currentPrice, originalPrice, hasDiscount, isFlashSale, isFixed, fixedAmountOff, discountPercent };
}

// True when a product carries an active, date-validated promotion.
function hasActivePromo(product: DealProduct) {
  return calcPricing(product).hasDiscount;
}

// Promoted products lead the grid regardless of the order the API returns them,
// so a "Hot Deals" section always shows its real deals first. Stable sort keeps
// the API's within-group ordering intact.
function promotedFirst(products: DealProduct[]): DealProduct[] {
  return products
    .map((product, index) => ({ product, index, promo: hasActivePromo(product) }))
    .sort((a, b) => (a.promo === b.promo ? a.index - b.index : a.promo ? -1 : 1))
    .map((entry) => entry.product);
}

// ─── Memoized card ────────────────────────────────────────────────────────────

interface DealProductCardProps {
  product: DealProduct;
  onQuickView: (product: DealProduct) => void;
}

const DealProductCard = memo(function DealProductCard({
  product,
  onQuickView,
}: DealProductCardProps) {
  const [imageError, setImageError] = useState(false);

  const imageUrl = product.primaryImage?.url || product.images?.[0]?.url || "";
  const pricing = calcPricing(product);
  const { size: bestSize } = resolveBestOffer(product);

  return (
    <div className="relative bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/product/${product.slug}`} className="block">
        {/* Image Container */}
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
          {!imageError && imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="motion-safe:transition-transform motion-safe:duration-300 object-contain hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
              <PiImageBroken size={40} className="text-gray-300" />
            </div>
          )}

          {/* Discount Badge */}
          {pricing.hasDiscount && (
            <div className="absolute top-0 left-0">
              <div className={`text-white text-[10px] font-bold px-2 py-1 rounded-br-lg flex items-center gap-1 ${
                pricing.isFlashSale
                  ? 'bg-gradient-to-r from-orange-500 to-red-500'
                  : pricing.isFixed
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-red-500 to-pink-500'
              }`}>
                {pricing.isFlashSale && <PiLightningFill size={8} />}
                {pricing.isFixed
                  ? `₦${pricing.fixedAmountOff.toLocaleString()}`
                  : `${pricing.discountPercent}% OFF`}
              </div>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-2.5">
          <h3 className="text-xs sm:text-sm font-medium text-gray-800 line-clamp-2 leading-tight min-h-[2rem]">
            {product.name}
          </h3>

          {/* Star Rating */}
          <div className="flex items-center gap-1 mt-1.5" aria-label={`Rating: ${product.rating || 4.5} out of 5, ${product.reviewCount || 0} reviews`}>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <PiStarFill
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
            <span className="text-[10px] text-gray-500">
              ({product.reviewCount || 0})
            </span>
          </div>

          {/* Stock Status */}
          <div className="mt-1.5">
            <StockStatus stock={bestSize?.stock ?? product.availableAt?.[0]?.sizes?.[0]?.stock} showProgress />
          </div>

          {/* Price and Add to Cart */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-sm font-bold text-red-500">
                  ₦{pricing.currentPrice.toLocaleString()}
                </span>
                {pricing.hasDiscount && (
                  <span className="text-[10px] text-gray-400 line-through">
                    ₦{pricing.originalPrice.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickView(product);
              }}
              className="min-h-10 min-w-10 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center flex-shrink-0"
              aria-label={`Quick view ${product.name}`}
            >
              <PiShoppingCartSimple size={16} />
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
});

// ─── Cache ────────────────────────────────────────────────────────────────────

const _dealsCache = new Map<number, { data: DealProduct[]; ts: number }>();
const DEALS_CACHE_TTL = 60_000;

// ─── Main component ───────────────────────────────────────────────────────────

const FeaturedDeals: React.FC<FeaturedDealsProps> = ({
  title = "Just For You",
  subtitle = "",
  limit = 12,
  initialProducts,
}) => {
  const seeded = (initialProducts?.length ?? 0) > 0;
  const [products, setProducts] = useState<DealProduct[]>(() => {
    if (seeded) return initialProducts!;
    const cached = _dealsCache.get(limit);
    return cached && Date.now() - cached.ts < DEALS_CACHE_TTL ? cached.data : [];
  });
  const [loading, setLoading] = useState(() => {
    if (seeded) return false;
    const cached = _dealsCache.get(limit);
    return !(cached && Date.now() - cached.ts < DEALS_CACHE_TTL);
  });
  const [hasError, setHasError] = useState(false);
  const { openQuickview } = useModalQuickviewContext() || {};

  useEffect(() => {
    // Server already seeded the deals into the HTML — don't refetch.
    if (seeded) return;
    const cached = _dealsCache.get(limit);
    if (cached && Date.now() - cached.ts < DEALS_CACHE_TTL) return;

    const fetchProducts = async () => {
      try {
        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        const res = await fetch(
          `${API_URL}/api/products?sortBy=discount&limit=${limit}`,
        );
        const data = await res.json();
        let prods: DealProduct[] = [];
        if (data.success && data.data?.products) {
          prods = data.data.products;
        } else if (Array.isArray(data.products)) {
          prods = data.products;
        } else if (Array.isArray(data)) {
          prods = data;
        }
        if (prods.length === 0) {
          setHasError(true);
        } else {
          _dealsCache.set(limit, { data: prods, ts: Date.now() });
          setProducts(prods);
        }
      } catch {
        setHasError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [limit, seeded]);

  const handleQuickView = useCallback(
    (product: DealProduct) => {
      if (openQuickview) {
        openQuickview(product as any);
      }
    },
    [openQuickview],
  );

  // Promoted deals lead the grid, then backfill; cap at `limit`.
  const orderedProducts = useMemo(
    () => promotedFirst(products).slice(0, limit),
    [products, limit],
  );

  if (loading) {
    return (
      <div className="px-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-t-xl aspect-square" />
              <div className="p-2.5 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-2 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hasError || products.length === 0) {
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
          More <PiCaretRightBold size={12} />
        </Link>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 px-3">
        {orderedProducts.map((product) => (
          <DealProductCard
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
