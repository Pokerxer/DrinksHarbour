'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';

const LAYOUT_OPTIONS = [
  { value: 2, label: '2 columns' },
  { value: 3, label: '3 columns' },
  { value: 4, label: '4 columns' },
  { value: 5, label: '5 columns' },
] as const;

interface RecentProduct {
  _id: string;
  id?: string;
  name: string;
  type: string;
  images?: { url: string }[];
  priceRange?: { min: number; max: number };
  discount?: { value: number } | number;
  brand?: { name: string };
  abv?: number;
  viewedAt?: string;
  slug?: string;
  price?: number;
  originPrice?: number;
  availableAt?: any[];
  thumbImage?: string[];
  primaryImage?: { url: string };
  }

interface RecentlyViewedProps {
  productId?: string;
  maxItems?: number;
  currentProduct?: {
    _id: string;
    name: string;
    type: string;
    slug?: string;
    images?: { url: string }[];
    priceRange?: { min: number; max: number };
    price?: number;
    originPrice?: number;
    discount?: number;
    brand?: { name: string };
    abv?: number;
    sale?: boolean;
    new?: boolean;
    availableAt?: any[];
    thumbImage?: string[];
    primaryImage?: { url: string };
  };
  layoutCol?: number;
}

const RecentlyViewed: React.FC<RecentlyViewedProps> = ({ productId, maxItems = 10, currentProduct, layoutCol = 4 }) => {
  const [products, setProducts] = useState<RecentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [layoutColumns, setLayoutColumns] = useState<number>(layoutCol);

  // Sync with layoutCol prop
  useEffect(() => {
    if (layoutCol && LAYOUT_OPTIONS.some(opt => opt.value === layoutCol)) {
      setLayoutColumns(layoutCol);
    }
  }, [layoutCol]);

  const STORAGE_KEY = 'drinksharbour_recently_viewed';

  const formatPrice = (price: number, currencySymbol: string = '₦') => {
    if (price == null || isNaN(price)) return `${currencySymbol}0`;
    return `${currencySymbol}${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Current selling price — lowest websitePrice across all vendor sizes.
  const getProductPrice = (product: any): number => {
    if (product.price) return product.price;
    if (product.priceRange?.min) return product.priceRange.min;
    const allPrices = (product.availableAt || []).flatMap((store: any) =>
      (store.sizes || []).map((size: any) => size.pricing?.websitePrice).filter(Boolean)
    );
    if (allPrices.length > 0) return Math.min(...allPrices);
    return 0;
  };

  // Pre-discount price — only populated when there is a real platform discount.
  // Never falls back to priceRange.max (which is just the most expensive size,
  // not a pre-discount price).
  const getProductOriginalPrice = (product: any): number => {
    const disc = product.discount as any;
    if (disc?.savings > 0 && disc?.originalPrice > 0) return disc.originalPrice;
    if (product.originPrice && product.originPrice > getProductPrice(product)) return product.originPrice;
    return 0;
  };

  const getCurrencySymbol = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('currency_symbol') || '₦';
    }
    return '₦';
  }, []);

  const getEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      wine: '🍷',
      beer: '🍺',
      whiskey: '🥃',
      vodka: '❄️',
      gin: '🌿',
      rum: '🏴‍☠️',
      tequila: '🌵',
      champagne: '🍾',
      brandy: '🍷',
      liqueur: '🍯',
    };
    return emojis[type?.toLowerCase()] || '🍹';
  };

  // Discount percentage for the badge — derived only from the platform discount
  // object (same source as the getAllProducts pipeline). Never computed from
  // priceRange min/max because that would show a fake discount when sizes simply
  // have different prices.
  const getDiscount = (product: RecentProduct): number => {
    const disc = product.discount as any;
    if (!disc || !(disc.savings > 0)) return 0;
    if (disc.type === 'percentage') return disc.value;
    // Fixed-amount discount: compute percentage from saved amount vs original price
    if (disc.originalPrice > 0) return Math.round((disc.savings / disc.originalPrice) * 100);
    return 0;
  };

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(!!data.user);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  const fetchRecentlyViewed = useCallback(async () => {
    try {
      const response = await fetch(`/api/user/recently-viewed?limit=${maxItems}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.products) {
          setProducts(data.data.products);
        }
      }
    } catch (error) {
      console.error('Error fetching recently viewed:', error);
      // Fallback to localStorage
      try {
        const local = localStorage.getItem('recentlyViewed');
        if (local) {
          setProducts(JSON.parse(local));
        }
      } catch (e) {
        console.error('Error reading localStorage:', e);
      }
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  const trackViewed = useCallback(async (prodId: string, productData?: typeof currentProduct) => {
    try {
      await fetch('/api/user/recently-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: prodId }),
      });
    } catch (error) {
      console.error('Error tracking viewed product:', error);
    }
  }, []);

  const saveToLocalStorage = useCallback((updatedProducts: RecentProduct[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProducts));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }, [STORAGE_KEY]);

  const getFromLocalStorage = useCallback((): RecentProduct[] => {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      return local ? JSON.parse(local) : [];
    } catch (e) {
      console.error('Error reading localStorage:', e);
      return [];
    }
  }, [STORAGE_KEY]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecentlyViewed();
      setIsInitialized(true);
    } else {
      const localProducts = getFromLocalStorage();
      setProducts(localProducts);
      setLoading(false);
      setIsInitialized(true);
    }
  }, [isAuthenticated, fetchRecentlyViewed, getFromLocalStorage]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!productId || !currentProduct) return;

    const addCurrentProduct = () => {
      const productIdStr = productId;

      if (isAuthenticated) {
        trackViewed(productIdStr, currentProduct);
      }

      const viewed = getFromLocalStorage();
      const existingIndex = viewed.findIndex(p => p._id === productIdStr || p.id === productIdStr);

      const newProduct: RecentProduct = {
        _id: productIdStr,
        id: productIdStr,
        name: currentProduct.name || '',
        type: currentProduct.type || '',
        slug: currentProduct.slug,
        images: currentProduct.images,
        priceRange: currentProduct.priceRange,
        price: currentProduct.price,
        originPrice: currentProduct.originPrice,
        discount: currentProduct.discount,
        brand: currentProduct.brand,
        abv: currentProduct.abv,
        viewedAt: new Date().toISOString(),
        availableAt: currentProduct.availableAt,
        thumbImage: currentProduct.thumbImage,
        primaryImage: currentProduct.primaryImage,
      };

      if (existingIndex !== -1) {
        viewed.splice(existingIndex, 1);
      }

      viewed.unshift(newProduct);
      const trimmed = viewed.slice(0, 20);
      saveToLocalStorage(trimmed);
      setProducts(trimmed);
    };

    addCurrentProduct();
  }, [productId, currentProduct, isAuthenticated, trackViewed, getFromLocalStorage, saveToLocalStorage, isInitialized]);

  const handleClearHistory = async () => {
    if (isAuthenticated) {
      try {
        await fetch('/api/user/recently-viewed', {
          method: 'DELETE',
        });
        setProducts([]);
      } catch (error) {
        console.error('Error clearing history:', error);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setProducts([]);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (p._id === productId || p.id === productId) return false;
      const hasStock = (p.availableAt || []).some((v: any) =>
        (v.sizes || []).some((s: any) => (s.stock ?? s.quantity ?? 0) > 0)
      );
      return hasStock;
    });
  }, [products, productId]);

  if (loading) {
    return (
      <section className="w-full bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse" />
            <div>
              <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-1" />
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          {/* Mobile skeleton */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[34%] flex-shrink-0 bg-gray-100 rounded-lg animate-pulse aspect-[4/5]" />
            ))}
          </div>
          {/* Desktop skeleton */}
          <div className="hidden md:grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-lg animate-pulse aspect-[4/5]" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (filteredProducts.length === 0) return null;

  return (
    <section className="w-full bg-white border-t border-gray-100 py-8 lg:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Icon.PiClockCounterClockwise size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900">Recently Viewed</h3>
              <p className="text-xs text-gray-500 hidden sm:block">Pick up where you left off</p>
            </div>
          </div>

          {/* Layout selector */}
          <div className="flex items-center gap-3">
            {/* Layout selector */}
            <div className="hidden md:flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              {LAYOUT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setLayoutColumns(value)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                    layoutColumns === value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title={label}
                >
                  {value}
                </button>
              ))}
            </div>

            <button
              onClick={handleClearHistory}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
            >
              <Icon.PiX size={14} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>

        {/* Desktop: CSS Grid */}

        {/* Desktop: CSS Grid */}
        <div className="hidden md:grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${layoutColumns}, minmax(0, 1fr))`,
          }}
        >
          {filteredProducts.slice(0, maxItems).map((product, index) => (
            <RecentlyViewedCard 
              key={`${product._id}-${index}`} 
              product={product} 
              index={index}
              getCurrencySymbol={getCurrencySymbol}
              getProductPrice={getProductPrice}
              getProductOriginalPrice={getProductOriginalPrice}
              getDiscount={getDiscount}
              formatPrice={formatPrice}
              getEmoji={getEmoji}
            />
          ))}
        </div>

        {/* Mobile: Horizontal scroll with snap */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
          {filteredProducts.slice(0, maxItems).map((product, index) => (
            <div 
              key={`${product._id}-${index}`} 
              className="w-[34%] flex-shrink-0 snap-start"
            >
              <RecentlyViewedCard 
                product={product} 
                index={index}
                getCurrencySymbol={getCurrencySymbol}
                getProductPrice={getProductPrice}
                getProductOriginalPrice={getProductOriginalPrice}
                getDiscount={getDiscount}
                formatPrice={formatPrice}
                getEmoji={getEmoji}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Extract card component for reuse
interface RecentlyViewedCardProps {
  product: RecentProduct;
  index: number;
  getCurrencySymbol: () => string;
  getProductPrice: (product: any) => number;
  getProductOriginalPrice: (product: any) => number;
  getDiscount: (product: RecentProduct) => number;
  formatPrice: (price: number, currencySymbol?: string) => string;
  getEmoji: (type: string) => string;
}

const RecentlyViewedCard: React.FC<RecentlyViewedCardProps> = ({
  product,
  index,
  getCurrencySymbol,
  getProductPrice,
  getProductOriginalPrice,
  getDiscount,
  formatPrice,
  getEmoji,
}) => {
  const discount = getDiscount(product);
  const vendorOnSale = (product.availableAt || []).some((v: any) => v.isOnSale === true);
  const isOnSale = discount > 0 || vendorOnSale;
  const productSlug = product.slug || product._id || product.id;
  const currencySymbol = getCurrencySymbol();
  const currentPrice = getProductPrice(product);
  const originalPrice = getProductOriginalPrice(product);

  const isOutOfStock = useMemo(() => {
    if (!product.availableAt || product.availableAt.length === 0) return true;
    const hasStock = product.availableAt.some((v: any) =>
      v.sizes?.some((s: any) => (s.stock || s.quantity || 0) > 0)
    );
    return !hasStock;
  }, [product]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link href={`/product/${productSlug}`}>
        <motion.div
          whileHover={{ y: -2 }}
          className="group bg-white rounded-lg overflow-hidden border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all duration-300 h-full"
        >
          {/* Image */}
          <div className="relative aspect-[4/5] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
            {product.images?.[0]?.url ? (
              <Image
                src={product.images[0].url}
                alt={product.name}
                fill
                className="object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 480px) 34vw, (max-width: 768px) 22vw, (max-width: 1024px) 18vw, 14vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl opacity-40">{getEmoji(product.type)}</span>
              </div>
            )}

            {/* Sale badge */}
            {isOnSale && !isOutOfStock && (
              <div className="absolute top-2 left-2">
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  -{discount}%
                </span>
              </div>
            )}

            {/* Out of Stock badge */}
            {isOutOfStock && (
              <div className="absolute top-2 left-2 z-10">
                <span className="px-1.5 py-0.5 bg-gray-900/90 text-white text-[10px] font-bold rounded-full">
                  OUT OF STOCK
                </span>
              </div>
            )}

            {/* Out of Stock overlay */}
            {isOutOfStock && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                <span className="px-2.5 py-1 bg-gray-900/85 text-white text-[10px] font-bold rounded-full shadow-lg tracking-wide">
                  Out of Stock
                </span>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded-full shadow">
                View
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="p-2">
            <p className="text-[9px] text-gray-400 mb-0.5 truncate">
              {product.brand?.name || product.type}
            </p>
            <h4 className="text-[11px] font-semibold text-gray-900 line-clamp-2 mb-1 min-h-[2.25rem] leading-tight">
              {product.name}
            </h4>
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className={`font-bold text-xs ${isOnSale ? 'text-red-600' : 'text-gray-900'}`}>
                {formatPrice(currentPrice, currencySymbol)}
              </span>
              {isOnSale && originalPrice > 0 && (
                <span className="text-[9px] text-gray-400 line-through">
                  {formatPrice(originalPrice, currencySymbol)}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};

export default RecentlyViewed;
