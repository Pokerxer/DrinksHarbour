"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import { useModalQuickviewContext } from "@/context/ModalQuickviewContext";
import { StockStatus } from "@/components/StockStatus";
import * as Icon from "react-icons/pi";
import "swiper/css";

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

interface SaleProduct {
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
    pricing?: { websitePrice?: number; originalWebsitePrice?: number };
  }>;
}

const CountdownTimer = ({ endTime }: { endTime: Date }) => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const calculate = () => {
      const diff = endTime.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }
      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        isExpired: false,
      });
    };
    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  if (timeLeft.isExpired) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-lg">
        <Icon.PiClock size={16} className="text-white" />
        <span className="text-white text-xs font-medium">Sale Ended</span>
      </div>
    );
  }

  const TimeBox = ({ value, label }: { value: number; label: string }) => (
    <div className="flex items-center gap-0.5">
      <div className="bg-white rounded-md px-1.5 py-0.5 min-w-[24px] text-center">
        <span className="text-red-600 font-bold text-xs tabular-nums">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[10px] text-white/90 font-medium">{label}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-1.5">
      <TimeBox value={timeLeft.hours} label="H" />
      <span className="text-white font-bold text-xs">:</span>
      <TimeBox value={timeLeft.minutes} label="M" />
      <span className="text-white font-bold text-xs">:</span>
      <TimeBox value={timeLeft.seconds} label="S" />
    </div>
  );
};

const FlashSaleCard = ({
  product,
  onQuickView,
}: {
  product: SaleProduct;
  onQuickView: (product: SaleProduct) => void;
}) => {
  const [imageError, setImageError] = useState(false);

  const imageUrl = product.primaryImage?.url || product.images?.[0]?.url || "";

  const allAvailableAt = product.availableAt || [];

  // Get price from first availableAt entry
  const firstAvailableAt = allAvailableAt[0];
  const firstSize = firstAvailableAt?.sizes?.[0];
  const sizePricing = firstSize?.pricing || firstAvailableAt?.pricing || {};

  let originalPrice =
    sizePricing.originalWebsitePrice ||
    sizePricing.websitePrice ||
    firstSize?.price ||
    product.priceRange?.min ||
    0;

  let salePrice =
    sizePricing.websitePrice ||
    firstSize?.price ||
    product.salePrice ||
    originalPrice;

  // Apply sale discount
  if (
    firstAvailableAt?.salePrice &&
    firstAvailableAt.salePrice < originalPrice
  ) {
    salePrice = firstAvailableAt.salePrice;
  }

  const hasDiscount = salePrice < originalPrice && salePrice > 0;
  const discountPercent = hasDiscount
    ? Math.round((1 - salePrice / originalPrice) * 100)
    : product.discount || 0;

  return (
    <div className="relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
      <Link href={`/product/${product.slug}`} className="block">
        {/* Image Container */}
        <div className="relative aspect-square bg-gray-50">
          {!imageError && imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
              <span className="text-5xl opacity-40">🍹</span>
            </div>
          )}

          {/* Discount Badge */}
          {discountPercent > 0 && (
            <div className="absolute top-0 left-0">
              <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-br-lg">
                -{discountPercent}%
              </div>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-2">
          <h3 className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight min-h-[2rem]">
            {product.name}
          </h3>

          {/* Stock Status */}
          <div className="mt-1">
            <StockStatus stock={firstSize?.stock} showProgress />
          </div>

          {/* Price and Add to Cart - Inline */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-sm font-bold text-red-500">
                  ₦{salePrice.toLocaleString()}
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
              className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-colors flex items-center justify-center flex-shrink-0"
            >
              <Icon.PiShoppingCartSimple size={16} />
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
};

const FlashSale = () => {
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { openQuickview } = useModalQuickviewContext() || {};

  const saleEndTime = new Date(Date.now() + 8 * 60 * 60 * 1000);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        const res = await fetch(`${API_URL}/api/products?onSale=true&limit=12`);
        const data = await res.json();
        if (data.success && data.data?.products) {
          setProducts(data.data.products);
        } else if (Array.isArray(data.products)) {
          setProducts(data.products);
        } else if (Array.isArray(data)) {
          setProducts(data);
        }
      } catch (error) {
        console.error("Error fetching sale products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleQuickView = useCallback(
    (product: SaleProduct) => {
      if (openQuickview) {
        openQuickview(product as any);
      }
    },
    [openQuickview],
  );

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-red-500 to-orange-500 py-6">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto pb-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-36 bg-white/20 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filter to only show products that actually have sale prices
  const saleProducts = products.filter((product) => {
    const originalPrice = product.priceRange?.min || 0;
    const salePrice = product.salePrice || 0;
    // Check if there's a valid discount
    const hasDiscount = salePrice > 0 && salePrice < originalPrice;
    // Also check availableAt for sale prices
    const hasAvailableAtSale = product.availableAt?.some(
      (at) =>
        at.salePrice &&
        at.salePrice <
          (at.pricing?.originalWebsitePrice ||
            at.pricing?.websitePrice ||
            Infinity),
    );
    return hasDiscount || hasAvailableAtSale;
  });

  if (saleProducts.length === 0) {
    return null;
  }

  return (
    <section className="bg-gradient-to-r from-red-500 via-orange-500 to-red-500 py-4">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                <Icon.PiLightningFill size={20} className="text-red-500" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-bounce" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                Flash Sale
                <span className="px-2 py-0.5 bg-yellow-400 text-red-600 text-[10px] font-bold rounded-full animate-bounce">
                  LIVE
                </span>
              </h2>
              <p className="text-white/80 text-xs">Limited time offers</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2">
              <Icon.PiClock size={16} className="text-white" />
              <CountdownTimer endTime={saleEndTime} />
            </div>
            <Link
              href="/shop?sale=true"
              className="hidden sm:flex items-center gap-1 px-3 py-2 bg-white text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
            >
              View All
              <Icon.PiArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Products Carousel */}
        <Swiper
          modules={[Autoplay]}
          autoplay={{ delay: 3000, disableOnInteraction: true }}
          loop={saleProducts.length > 4}
          spaceBetween={12}
          breakpoints={{
            320: { slidesPerView: 2 },
            480: { slidesPerView: 2.5 },
            640: { slidesPerView: 3.5 },
            768: { slidesPerView: 4.5 },
            1024: { slidesPerView: 5.5 },
          }}
          className="pb-4 -mx-4 px-4"
        >
          {saleProducts.map((product) => (
            <SwiperSlide key={product._id}>
              <FlashSaleCard product={product} onQuickView={handleQuickView} />
            </SwiperSlide>
          ))}
        </Swiper>

        {/* View All Link */}
        <div className="text-center mt-2">
          <Link
            href="/shop?sale=true"
            className="inline-flex items-center gap-1 text-white text-sm font-medium hover:underline"
          >
            View All <Icon.PiArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FlashSale;
