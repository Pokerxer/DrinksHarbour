'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useRouter } from 'next/navigation';

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
  };
}

const RecentlyViewed: React.FC<RecentlyViewedProps> = ({ productId, maxItems = 6, currentProduct }) => {
  const router = useRouter();
  const [products, setProducts] = useState<RecentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const STORAGE_KEY = 'drinksharbour_recently_viewed';

  const formatPrice = (price: number, currencySymbol: string = '₦') => {
    if (price == null || isNaN(price)) return `${currencySymbol}0`;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
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

  const getDiscount = (product: RecentProduct) => {
    if (product.discount && typeof product.discount === 'object' && 'value' in product.discount && product.discount.value && product.discount.value > 0) {
      return product.discount.value;
    }
    if (typeof product.discount === 'number' && product.discount > 0) {
      return product.discount;
    }
    if (product.priceRange?.min !== undefined && product.priceRange?.max !== undefined) {
      if (product.priceRange.max > product.priceRange.min) {
        return Math.round(((product.priceRange.max - product.priceRange.min) / product.priceRange.max) * 100);
      }
    }
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
    return products.filter(p => p._id !== productId && p.id !== productId);
  }, [products, productId]);

  if (loading) {
    return (
      <section className="w-full bg-white border-t border-gray-100">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gray-200 animate-pulse" />
            <div>
              <div className="h-4 w-28 sm:h-5 sm:w-36 bg-gray-200 rounded animate-pulse mb-1" />
              <div className="h-2 w-20 sm:h-3 sm:w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-lg sm:rounded-xl animate-pulse aspect-[4/5] sm:aspect-square" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (filteredProducts.length === 0) return null;

  return (
    <section className="w-full bg-white border-t border-gray-100">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Icon.PiClockCounterClockwise size={20} className="text-white w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                Recently Viewed
              </h3>
              <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">
                Pick up where you left off
              </p>
            </div>
          </div>

          <button
            onClick={handleClearHistory}
            className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
          >
            Clear
            <Icon.PiX size={14} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>

        {/* Products Grid - Temu style gallery */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:gap-5">
          <AnimatePresence mode="popLayout">
            {filteredProducts.slice(0, maxItems).map((product, index) => {
              const discount = getDiscount(product);
              const isOnSale = discount > 0;
              const productSlug = product.slug || product._id || product.id;
              const currencySymbol = getCurrencySymbol();

              return (
                <motion.div
                  key={`${product._id}-${product.id}-${index}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Link href={`/product/${productSlug}`}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="group bg-white rounded-lg sm:rounded-xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-300"
                    >
                      {/* Image */}
                      <div className="relative aspect-[4/5] sm:aspect-square bg-gradient-to-br from-gray-100 to-gray-50">
                        {product.images?.[0]?.url ? (
                          <Image
                            src={product.images[0].url}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-3xl sm:text-4xl opacity-50">{getEmoji(product.type)}</span>
                          </div>
                        )}

                        {/* Sale Badge */}
                        {isOnSale && (
                          <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2">
                            <span className="px-1.5 sm:px-2 py-0.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full">
                              -{discount}%
                            </span>
                          </div>
                        )}

                        {/* Quick View overlay */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          whileHover={{ opacity: 1 }}
                          className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white text-gray-900 text-[10px] sm:text-xs font-semibold rounded-full">
                            View
                          </span>
                        </motion.div>
                      </div>

                      {/* Content */}
                      <div className="p-2 sm:p-3">
                        <p className="text-[9px] sm:text-[10px] text-gray-400 mb-0.5 truncate">
                          {product.brand?.name || product.type}
                        </p>
                        <h4 className="text-[11px] sm:text-xs font-semibold text-gray-900 line-clamp-2 mb-1 sm:mb-1.5 min-h-[2rem] sm:min-h-[2.5rem]">
                          {product.name || 'Loading...'}
                        </h4>
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <span className={`font-bold text-xs sm:text-sm ${isOnSale ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatPrice(product.priceRange?.min || product.price || 0, currencySymbol)}
                          </span>
                          {isOnSale && (product.priceRange?.max || product.originPrice) && (
                            <span className="text-[9px] sm:text-[10px] text-gray-400 line-through">
                              {formatPrice(product.priceRange?.max || product.originPrice || 0, currencySymbol)}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default RecentlyViewed;
