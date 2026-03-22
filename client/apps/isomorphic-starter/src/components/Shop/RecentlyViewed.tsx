'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface RecentlyViewedProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  type?: string;
  slug: string;
  viewedAt: number;
}

interface RecentlyViewedProps {
  maxItems?: number;
  onClose?: () => void;
}

const RECENTLY_VIEWED_KEY = 'drinksharbour_recently_viewed';

const RecentlyViewed: React.FC<RecentlyViewedProps> = ({ maxItems = 8, onClose }) => {
  const [products, setProducts] = useState<RecentlyViewedProduct[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    loadRecentlyViewed();
  }, []);

  const loadRecentlyViewed = () => {
    try {
      const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentlyViewedProduct[];
        const sorted = parsed.sort((a, b) => b.viewedAt - a.viewedAt).slice(0, maxItems);
        setProducts(sorted);
        setIsVisible(sorted.length > 0);
      }
    } catch (error) {
      console.error('Error loading recently viewed:', error);
    }
  };

  const removeProduct = (id: string) => {
    try {
      const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentlyViewedProduct[];
        const filtered = parsed.filter(p => p.id !== id);
        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(filtered));
        setProducts(filtered);
        if (filtered.length === 0) {
          setIsVisible(false);
        }
      }
    } catch (error) {
      console.error('Error removing product:', error);
    }
  };

  const clearAll = () => {
    try {
      localStorage.removeItem(RECENTLY_VIEWED_KEY);
      setProducts([]);
      setIsVisible(false);
    } catch (error) {
      console.error('Error clearing recently viewed:', error);
    }
  };

  if (!isVisible || products.length === 0) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
            <Icon.PiClockCounterClockwise size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Recently Viewed</h3>
            <p className="text-xs text-gray-500">{products.length} item{products.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {products.length > 2 && (
            <button
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 hover:bg-gray-100 rounded-lg"
            >
              Clear All
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon.PiX size={18} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="p-4">
        <div className="grid grid-cols-4 gap-3">
          {products.slice(0, 4).map((product, index) => {
            const hasDiscount = product.originalPrice && product.originalPrice > product.price;
            const discount = hasDiscount 
              ? Math.round((1 - product.price / product.originalPrice!) * 100)
              : 0;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                className="relative group"
              >
                <Link href={`/product/${product.slug}`}>
                  <div className="relative aspect-square rounded-xl bg-gray-100 overflow-hidden border border-gray-200 group-hover:border-gray-300 transition-colors">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="80px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-3xl">
                        🍷
                      </div>
                    )}
                    
                    {/* Discount Badge */}
                    {hasDiscount && (
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-md">
                        -{discount}%
                      </div>
                    )}

                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeProduct(product.id);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white hover:shadow-md"
                    >
                      <Icon.PiX size={12} className="text-gray-500" />
                    </button>
                  </div>

                  {/* Product Info */}
                  <div className="mt-2">
                    <h4 className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight group-hover:text-gray-700 transition-colors">
                      {product.name}
                    </h4>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs font-bold text-gray-900">
                        {formatPrice(product.price)}
                      </span>
                      {hasDiscount && (
                        <span className="text-[10px] text-gray-400 line-through">
                          {formatPrice(product.originalPrice!)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* View All Link */}
        {products.length > 4 && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <Link
              href="/shop?viewed=true"
              className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors inline-flex items-center gap-1"
            >
              View all {products.length} recently viewed
              <Icon.PiArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const addToRecentlyViewed = (product: Omit<RecentlyViewedProduct, 'viewedAt'>) => {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    let products: RecentlyViewedProduct[] = stored ? JSON.parse(stored) : [];

    products = products.filter(p => p.id !== product.id);

    products.unshift({
      ...product,
      viewedAt: Date.now(),
    });

    products = products.slice(0, 20);

    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(products));
  } catch (error) {
    console.error('Error adding to recently viewed:', error);
  }
};

export default RecentlyViewed;
