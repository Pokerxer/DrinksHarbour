'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useRouter } from 'next/navigation';

interface RecentProduct {
  _id: string;
  name: string;
  type: string;
  images?: { url: string }[];
  priceRange?: { min: number; max: number };
  discount?: { value: number };
  brand?: { name: string };
  abv?: number;
  viewedAt?: string;
}

interface RecentlyViewedProps {
  productId?: string;
  maxItems?: number;
}

const RecentlyViewed: React.FC<RecentlyViewedProps> = ({ productId, maxItems = 6 }) => {
  const router = useRouter();
  const [products, setProducts] = useState<RecentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

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
    if (product.discount?.value && product.discount.value > 0) {
      return product.discount.value;
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

  const trackViewed = useCallback(async (prodId: string) => {
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

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecentlyViewed();
    } else {
      // Fallback to localStorage for non-logged-in users
      try {
        const local = localStorage.getItem('recentlyViewed');
        if (local) {
          setProducts(JSON.parse(local));
        }
      } catch (e) {
        console.error('Error reading localStorage:', e);
      }
      setLoading(false);
    }
  }, [isAuthenticated, fetchRecentlyViewed]);

  useEffect(() => {
    if (productId) {
      // Track this product view
      if (isAuthenticated) {
        trackViewed(productId);
      } else {
        // Save to localStorage for non-logged-in users
        try {
          const local = localStorage.getItem('recentlyViewed');
          let viewed: RecentProduct[] = local ? JSON.parse(local) : [];
          
          // Remove if already exists
          viewed = viewed.filter(p => p._id !== productId);
          
          // Add to beginning (with minimal data for now)
          viewed.unshift({ _id: productId, name: '', type: '' } as RecentProduct);
          
          // Keep only last 20
          viewed = viewed.slice(0, 20);
          
          localStorage.setItem('recentlyViewed', JSON.stringify(viewed));
        } catch (e) {
          console.error('Error saving to localStorage:', e);
        }
      }
    }
  }, [productId, isAuthenticated, trackViewed]);

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
      localStorage.removeItem('recentlyViewed');
      setProducts([]);
    }
  };

  if (loading) {
    return (
      <section className="w-full bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse" />
            <div>
              <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-1" />
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-44 h-52 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="w-full bg-white border-t border-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Icon.PiClockCounterClockwise size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900">
                Recently Viewed
              </h3>
              <p className="text-xs text-gray-500">
                Pick up where you left off
              </p>
            </div>
          </div>

          <button 
            onClick={handleClearHistory}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
          >
            Clear History
            <Icon.PiX size={14} />
          </button>
        </div>

        {/* Products Scroll */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
          <AnimatePresence mode="popLayout">
            {products.map((product, index) => {
              const discount = getDiscount(product);
              const isOnSale = discount > 0;

              return (
                <motion.div
                  key={product._id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex-shrink-0 w-44"
                >
                  <Link href={`/product/${product._id}`}>
                    <motion.div
                      whileHover={{ y: -4 }}
                      className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
                    >
                      {/* Image */}
                      <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-50">
                        {product.images?.[0]?.url ? (
                          <Image
                            src={product.images[0].url}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="176px"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl opacity-50">{getEmoji(product.type)}</span>
                          </div>
                        )}

                        {/* Sale Badge */}
                        {isOnSale && (
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                              -{discount}%
                            </span>
                          </div>
                        )}

                        {/* Quick View */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          whileHover={{ opacity: 1 }}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded-full">
                            View
                          </span>
                        </motion.div>
                      </div>

                      {/* Content */}
                      <div className="p-3">
                        <p className="text-[10px] text-gray-400 mb-0.5 truncate">
                          {product.brand?.name || product.type}
                        </p>
                        <h4 className="text-xs font-semibold text-gray-900 line-clamp-2 mb-1.5 min-h-[2rem]">
                          {product.name || 'Loading...'}
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold text-sm ${isOnSale ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatPrice(product.priceRange?.min || 0)}
                          </span>
                          {isOnSale && product.priceRange?.max && (
                            <span className="text-[10px] text-gray-400 line-through">
                              {formatPrice(product.priceRange.max)}
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
