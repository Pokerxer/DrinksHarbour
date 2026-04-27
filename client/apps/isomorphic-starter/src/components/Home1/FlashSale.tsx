"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation } from "swiper/modules";
import { useModalQuickviewContext } from "@/context/ModalQuickviewContext";
import { StockStatus } from "@/components/StockStatus";
import * as Icon from "react-icons/pi";
import "swiper/css";
import "swiper/css/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SizeDiscount {
  hasDiscount?: boolean;
  type?: string;
  value?: number;
  percentage?: number;
  savings?: number;
  originalPrice?: number;
  source?: string;
  label?: string;
}

interface SizePricing {
  websitePrice?: number;
  originalWebsitePrice?: number;
  currency?: string;
  formattedPrice?: string;
}

interface ProductSize {
  _id?: string;
  size: string;
  volumeMl?: number;
  stock?: number;
  pricing?: SizePricing;
  discount?: SizeDiscount;
}

interface AvailableAt {
  _id?: string;
  tenant?: { _id?: string; name?: string; slug?: string };
  sizes?: ProductSize[];
  isOnSale?: boolean;
  saleType?: string;
  saleDiscountValue?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  effectiveSalePrice?: number | null;
  priceRange?: { min: number; max: number };
}

interface SaleProduct {
  _id: string;
  name: string;
  slug: string;
  images?: Array<{ url: string; isPrimary?: boolean }>;
  primaryImage?: { url: string };
  priceRange?: { min: number; max: number };
  totalSold?: number;
  averageRating?: number;
  reviewCount?: number;
  availableAt?: AvailableAt[];
  discount?: SizeDiscount | null;
  stockInfo?: { totalStock: number; availableStock: number };
  availability?: { status: string; stockLevel: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the best (most-discounted) sale info for a product */
function getBestSale(product: SaleProduct) {
  const allAt = product.availableAt || [];

  let bestDiscount: SizeDiscount | null = null;
  let bestSize: ProductSize | null = null;
  let bestAt: AvailableAt | null = null;

  for (const at of allAt) {
    for (const size of at.sizes || []) {
      const d = size.discount;
      if (!d?.hasDiscount) continue;
      if (!bestDiscount || (d.savings ?? 0) > (bestDiscount.savings ?? 0)) {
        bestDiscount = d;
        bestSize = size;
        bestAt = at;
      }
    }
  }

  if (!bestDiscount || !bestSize || !bestAt) {
    // Fallback: use priceRange min vs originalWebsitePrice from first size
    const firstAt = allAt[0];
    const firstSize = firstAt?.sizes?.[0];
    const pricing = firstSize?.pricing || {};
    const current = pricing.websitePrice || product.priceRange?.min || 0;
    const original = pricing.originalWebsitePrice || current;
    const savings = original - current;
    return {
      currentPrice: current,
      originalPrice: original,
      hasDiscount: savings > 0 && current > 0,
      discountPct: savings > 0 ? Math.round((savings / original) * 100) : 0,
      saleType: firstAt?.saleType || null,
      saleEndDate: firstAt?.saleEndDate || null,
      stock: firstSize?.stock,
      discountLabel: null,
    };
  }

  return {
    currentPrice: bestSize.pricing?.websitePrice ?? 0,
    originalPrice: bestDiscount.originalPrice ?? bestSize.pricing?.websitePrice ?? 0,
    hasDiscount: true,
    discountPct: bestDiscount.percentage ?? 0,
    saleType: bestAt.saleType || null,
    saleEndDate: bestAt.saleEndDate || null,
    stock: bestSize.stock,
    discountLabel: bestDiscount.label || null,
  };
}

/** Pick the nearest upcoming sale end time from all products */
function getNearestEndTime(products: SaleProduct[]): Date {
  const now = Date.now();
  const times = products
    .flatMap((p) => p.availableAt || [])
    .filter((at) => at.isOnSale && at.saleEndDate)
    .map((at) => new Date(at.saleEndDate!).getTime())
    .filter((t) => t > now);

  times.sort((a, b) => a - b);
  // Return nearest end, or 8-hour fallback
  return times.length > 0 ? new Date(times[0]) : new Date(now + 8 * 60 * 60 * 1000);
}

// ─── CountdownTimer ───────────────────────────────────────────────────────────

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

const CountdownTimer = ({
  endTime,
  onExpire,
}: {
  endTime: Date;
  onExpire?: () => void;
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;

    const calculate = () => {
      const diff = endTime.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire?.();
        }
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        isExpired: false,
      });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [endTime, onExpire]);

  if (timeLeft.isExpired) {
    return (
      <div className="flex items-center gap-1.5 text-white/80 text-xs">
        <Icon.PiClock size={14} />
        <span>Sale Ended</span>
      </div>
    );
  }

  const TimeBox = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg w-9 h-9 flex items-center justify-center">
        <span className="text-white font-black text-sm tabular-nums leading-none">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[9px] text-white/70 font-medium mt-0.5 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );

  const Colon = () => (
    <span className="text-white font-black text-base mb-3 opacity-80">:</span>
  );

  return (
    <div className="flex items-end gap-1">
      {timeLeft.days > 0 && (
        <>
          <TimeBox value={timeLeft.days} label="Days" />
          <Colon />
        </>
      )}
      <TimeBox value={timeLeft.hours} label="Hrs" />
      <Colon />
      <TimeBox value={timeLeft.minutes} label="Min" />
      <Colon />
      <TimeBox value={timeLeft.seconds} label="Sec" />
    </div>
  );
};

// ─── FlashSaleCard ────────────────────────────────────────────────────────────

const FlashSaleCard = ({
  product,
  onQuickView,
}: {
  product: SaleProduct;
  onQuickView: (product: SaleProduct) => void;
}) => {
  const [imageError, setImageError] = useState(false);
  const sale = getBestSale(product);

  const imageUrl = product.primaryImage?.url || product.images?.[0]?.url || "";
  const isFlashSale = sale.saleType === "flash_sale";
  const isFixed = sale.saleType === "fixed";

  const totalStock = product.stockInfo?.totalStock ?? 100;
  const availableStock = product.stockInfo?.availableStock ?? sale.stock ?? 100;

  return (
    <div className="relative bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
      <Link href={`/product/${product.slug}`} className="block">
        {/* Image */}
        <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100">
          {!imageError && imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl opacity-30">🍹</span>
            </div>
          )}

          {/* Discount Badge */}
          {sale.hasDiscount && (
            <div className="absolute top-0 left-0">
              <div
                className={`text-white text-[10px] font-black px-2 py-1 rounded-br-xl flex items-center gap-0.5 ${
                  isFlashSale
                    ? "bg-gradient-to-br from-orange-500 to-red-600"
                    : isFixed
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                      : "bg-gradient-to-br from-red-500 to-pink-600"
                }`}
              >
                {isFlashSale && <Icon.PiLightningFill size={9} />}
                {sale.discountLabel ||
                  (isFixed
                    ? `₦${(sale.originalPrice - sale.currentPrice).toLocaleString()} OFF`
                    : `${sale.discountPct}% OFF`)}
              </div>
            </div>
          )}

          {/* Flash Sale type indicator */}
          {isFlashSale && (
            <div className="absolute top-0 right-0 m-1">
              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center animate-pulse">
                <Icon.PiLightningFill size={12} className="text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5">
          <h3 className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-tight min-h-[2rem]">
            {product.name}
          </h3>

          {/* Stock progress */}
          <div className="mt-1.5">
            <StockStatus
              stock={sale.stock}
              totalStock={totalStock}
              availableStock={availableStock}
              showProgress
            />
          </div>

          {/* Price row */}
          <div className="mt-2 flex items-center justify-between gap-1">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black text-red-500 leading-tight">
                ₦{sale.currentPrice.toLocaleString()}
              </span>
              {sale.hasDiscount && sale.originalPrice > sale.currentPrice && (
                <span className="text-[10px] text-gray-400 line-through leading-tight">
                  ₦{sale.originalPrice.toLocaleString()}
                </span>
              )}
            </div>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickView(product);
              }}
              className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 active:scale-95 transition-all flex items-center justify-center shadow-sm"
              aria-label="Quick add to cart"
            >
              <Icon.PiShoppingCartSimple size={15} />
            </button>
          </div>

          {/* Sold count */}
          {(product.totalSold ?? 0) > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <Icon.PiFireSimple size={10} className="text-orange-400" />
              <span className="text-[9px] text-gray-400">
                {(product.totalSold! >= 1000
                  ? `${(product.totalSold! / 1000).toFixed(1)}k`
                  : product.totalSold
                )}{" "}
                sold
              </span>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-white/20 rounded-2xl overflow-hidden animate-pulse">
    <div className="aspect-square bg-white/20" />
    <div className="p-2.5 space-y-2">
      <div className="h-3 bg-white/20 rounded w-4/5" />
      <div className="h-3 bg-white/20 rounded w-3/5" />
      <div className="h-4 bg-white/20 rounded w-1/2 mt-3" />
    </div>
  </div>
);

// ─── FlashSale (main) ─────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

async function fetchSaleProducts(saleType?: string): Promise<SaleProduct[]> {
  const params = new URLSearchParams({
    onSale: "true",
    limit: "20",
    inStock: "false", // include out-of-stock to keep section populated
  });
  if (saleType) params.set("saleType", saleType);

  const res = await fetch(`${API_URL}/api/products?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.success && data.data?.products) return data.data.products;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data)) return data;
  return [];
}

const FlashSale = () => {
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFlashSaleSection, setIsFlashSaleSection] = useState(false);
  const { openQuickview } = useModalQuickviewContext() || {};

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchSaleProducts();
      setIsFlashSaleSection(items.some((p) =>
        (p.availableAt || []).some((at) => at.saleType === "flash_sale")
      ));

      // Keep only products with an active price discount
      const withDiscount = items.filter((p) =>
        (p.availableAt || []).some((at) =>
          (at.sizes || []).some((s) => s.discount?.hasDiscount)
        )
      );
      setProducts(withDiscount.length > 0 ? withDiscount : items);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleQuickView = useCallback(
    (product: SaleProduct) => openQuickview?.(product as any),
    [openQuickview]
  );

  const saleEndTime = products.length > 0 ? getNearestEndTime(products) : new Date(Date.now() + 8 * 60 * 60 * 1000);

  if (loading) {
    return (
      <section className="bg-gradient-to-r from-red-500 via-orange-500 to-red-500 py-5">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl animate-pulse" />
            <div className="h-6 w-32 bg-white/20 rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  const label = isFlashSaleSection ? "Flash Sale" : "On Sale Now";
  const sublabel = isFlashSaleSection ? "Lightning deals — ends soon!" : "Limited time offers";

  return (
    <section className="bg-gradient-to-r from-red-500 via-orange-500 to-red-500 relative overflow-hidden py-5">
      {/* Decorative glow blobs */}
      <div className="absolute -top-8 -left-8 w-48 h-48 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-red-700/30 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          {/* Left: icon + title */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-red-900/30">
                <Icon.PiLightningFill size={22} className="text-orange-500" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-bounce border-2 border-orange-500" />
            </div>
            <div>
              <h2 className="text-white font-black text-xl leading-tight flex items-center gap-2">
                {label}
                <span className="px-2 py-0.5 bg-yellow-400 text-red-700 text-[10px] font-black rounded-full animate-pulse">
                  LIVE
                </span>
              </h2>
              <p className="text-white/75 text-xs leading-tight">{sublabel}</p>
            </div>
          </div>

          {/* Right: countdown + view all */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm border border-white/20 rounded-2xl px-3 py-2">
              <Icon.PiClock size={15} className="text-white/70 flex-shrink-0" />
              <CountdownTimer endTime={saleEndTime} onExpire={load} />
            </div>
            <Link
              href="/shop?sale=true"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 bg-white text-orange-600 rounded-xl text-xs font-black hover:bg-orange-50 active:scale-95 transition-all shadow-sm"
            >
              View All <Icon.PiArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* ── Products Carousel ── */}
        <Swiper
          modules={[Autoplay, Navigation]}
          autoplay={{ delay: 3500, disableOnInteraction: true, pauseOnMouseEnter: true }}
          loop={products.length > 4}
          spaceBetween={12}
          breakpoints={{
            320: { slidesPerView: 2 },
            480: { slidesPerView: 2.5 },
            640: { slidesPerView: 3.5 },
            768: { slidesPerView: 4.5 },
            1024: { slidesPerView: 5.5 },
            1280: { slidesPerView: 6 },
          }}
          className="pb-2 -mx-4 px-4"
        >
          {products.map((product) => (
            <SwiperSlide key={product._id}>
              <FlashSaleCard product={product} onQuickView={handleQuickView} />
            </SwiperSlide>
          ))}
        </Swiper>

        {/* ── Mobile "View All" ── */}
        <div className="text-center mt-3 sm:hidden">
          <Link
            href="/shop?sale=true"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-bold rounded-xl transition-colors"
          >
            View All {products.length}+ Deals <Icon.PiArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FlashSale;
