'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface RecentProduct {
  _id: string;
  name: string;
  type: string;
  images?: { url: string }[];
  priceRange?: { min: number; max: number };
  discount?: { value: number };
  brand?: { name: string };
  abv?: number;
}

interface RecentlyViewedProps {
  products: RecentProduct[];
  maxItems?: number;
}

const RecentlyViewed: React.FC<RecentlyViewedProps> = ({ products, maxItems = 6 }) => {
  const recentProducts = useMemo(() => {
    return products.slice(0, maxItems);
  }, [products, maxItems]);

  if (recentProducts.length === 0) return null;

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

          <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1">
            Clear History
            <Icon.PiX size={14} />
          </button>
        </div>

        {/* Products Scroll */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
          <AnimatePresence mode="popLayout">
            {recentProducts.map((product, index) => {
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
                          {product.name}
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
