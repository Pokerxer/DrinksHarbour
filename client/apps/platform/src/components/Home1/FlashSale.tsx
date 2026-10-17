"use client";
import { useShoppingLocation } from '@/context/ShoppingLocationContext';
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation } from "swiper/modules";
import { useModalQuickviewContext } from "@/context/ModalQuickviewContext";
import { API_URL } from "@/lib/api";
import type { ProductType } from "@/types/product.types";
import { PiLightningFill, PiClock, PiArrowRight } from "react-icons/pi";
import FlashSaleCard from "./FlashSaleCard";
import FlashSaleEmpty from "./FlashSaleEmpty";
import CountdownTimer from "./FlashSaleCountdown";
import type { SaleProduct } from "./flash-sale-types";
import { getNearestEndTime, isSaleProduct, isActiveFlashSale } from "./flash-sale-helpers";
import { fetchFlashSaleProducts } from "./flash-sale-data";
import "swiper/css";
import "swiper/css/navigation";
const FLASH_SALE_HREF = "/deals";
// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-white/20 rounded-2xl overflow-hidden motion-safe:animate-pulse">
    <div className="aspect-square bg-white/20" />
    <div className="p-2.5 space-y-2">
      <div className="h-3 bg-white/20 rounded w-4/5" />
      <div className="h-3 bg-white/20 rounded w-3/5" />
      <div className="h-4 bg-white/20 rounded w-1/2 mt-3" />
    </div>
  </div>
);

// ─── FlashSale (main) ─────────────────────────────────────────────────────────

interface FlashSaleProps {
  initialProducts?: SaleProduct[];
  /** When true, render only currently active flash-sale offers. */
  flashOnly?: boolean;
  /** True only for a successful, complete server flash-sale request. */
  initialProductsComplete?: boolean;
  showEmptyState?: boolean;
}

const FlashSale = ({ initialProducts = [], flashOnly = false, initialProductsComplete = false, showEmptyState = false }: FlashSaleProps) => {
  const { location, revision } = useShoppingLocation();
  const requestRef = React.useRef(0);
  const filterProducts = useCallback((products: SaleProduct[]) => {
    const eligible = products.filter(isSaleProduct);
    return (flashOnly ? eligible.filter(isActiveFlashSale) : eligible).slice(0, 20);
  }, [flashOnly]);
  const seededProducts = useMemo(() => filterProducts(initialProducts), [filterProducts, initialProducts]);
  const [products, setProducts] = useState<SaleProduct[]>(seededProducts);
  const [loading, setLoading] = useState(!initialProductsComplete && seededProducts.length === 0);
  const isFlashSaleSection = products.some(isActiveFlashSale);
  const { openQuickview } = useModalQuickviewContext() || {};

  const load = useCallback(async () => {
    // Seeded deals are already available from the homepage server request.
    // Refresh them in the background without replacing them with a skeleton.
    const requestId = ++requestRef.current;
    try {
      const items = await fetchFlashSaleProducts(API_URL, location, flashOnly);
      const withDiscount = filterProducts(items);
      if (requestRef.current === requestId) setProducts(withDiscount);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filterProducts, flashOnly, revision]);

  useEffect(() => {
    if (!initialProductsComplete || location) void load();
    else setProducts(seededProducts);
    return () => { requestRef.current++; };
  }, [load, initialProductsComplete]);

  const handleQuickView = useCallback(
    (product: SaleProduct) => openQuickview?.(product as unknown as ProductType),
    [openQuickview]
  );

  const saleEndTime = useMemo(() => getNearestEndTime(products), [products]);

  if (loading) {
    return (
      <section className="bg-gradient-to-r from-red-500 via-orange-500 to-red-500 py-5">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl motion-safe:animate-pulse" />
            <div className="h-6 w-32 bg-white/20 rounded-lg motion-safe:animate-pulse" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return flashOnly || showEmptyState ? <FlashSaleEmpty /> : null;

  const label = isFlashSaleSection ? "Flash Sale" : "On Sale Now";
  const sublabel = isFlashSaleSection ? "Lightning deals — ends soon!" : "Limited time offers";

  return (
    <section className="bg-gradient-to-r from-red-500 via-orange-500 to-red-500 relative overflow-hidden py-5">
      {/* Decorative glow blobs */}
      <div className="absolute -top-8 -left-8 w-48 h-48 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-red-700/30 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        {/* ── Header ── */}
        <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-4 mb-4">
          {/* Left: icon + title */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-red-900/30">
                <PiLightningFill size={22} className="text-orange-500" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full motion-safe:animate-bounce border-2 border-orange-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-black text-lg sm:text-xl leading-tight flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                {label}
                <span className="px-1.5 sm:px-2 py-0.5 bg-yellow-400 text-red-700 text-[9px] sm:text-[10px] font-black rounded-full motion-safe:animate-pulse">
                  LIVE
                </span>
              </h2>
              <p className="text-white/75 text-[10px] sm:text-xs leading-tight truncate">{sublabel}</p>
            </div>
          </div>

          {/* Right: countdown + view all */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex shrink-0 items-center gap-1 sm:gap-2 bg-black/20 backdrop-blur-sm border border-white/20 rounded-2xl px-2 sm:px-3 py-1.5 sm:py-2">
              <PiClock size={15} className="text-white/70 flex-shrink-0" />
              <CountdownTimer endTime={saleEndTime} onExpire={load} />
            </div>
            <Link
              href={FLASH_SALE_HREF}
              onClick={(event) => event.stopPropagation()}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 bg-white text-orange-600 rounded-xl text-xs font-black hover:bg-orange-50 motion-safe:active:scale-95 transition-all shadow-sm"
            >
              View All <PiArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* ── Products Carousel ── */}
        <Swiper
          modules={[Autoplay, Navigation]}
          slidesPerView={2}
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
            href={FLASH_SALE_HREF}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-bold rounded-xl transition-colors"
          >
            View All {products.length}+ Deals <PiArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FlashSale;
