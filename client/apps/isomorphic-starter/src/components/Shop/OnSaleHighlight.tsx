'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface OnSaleProduct {
  _id: string;
  name: string;
  type: string;
  images?: { url: string }[];
  priceRange?: { min: number; max: number };
  discount?: { value: number; type?: string };
  brand?: { name: string };
  abv?: number;
}

interface OnSaleHighlightProps {
  products: OnSaleProduct[];
}

const OnSaleHighlight: React.FC<OnSaleHighlightProps> = ({ products }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const saleProducts = useMemo(() => {
    return products.filter(p => 
      (p.discount?.value && p.discount.value > 0) ||
      (p.priceRange?.min !== undefined && p.priceRange?.max !== undefined && p.priceRange.min < p.priceRange.max)
    ).slice(0, 8);
  }, [products]);

  const displayedProducts = isExpanded ? saleProducts : saleProducts.slice(0, 4);

  if (saleProducts.length === 0) return null;

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

  return (
    <section className="w-full bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 border-b border-red-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/25"
            >
              <Icon.PiTagSimple size={24} className="text-white" />
            </motion.div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900">
                On Sale Now
              </h2>
              <p className="text-sm text-gray-500">
                {saleProducts.length} product{saleProducts.length !== 1 ? 's' : ''} with amazing discounts
              </p>
            </div>
          </div>

          <Link href="/shop?sale=true">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-full font-semibold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              View All
              <Icon.PiArrowRight size={16} />
            </motion.button>
          </Link>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {displayedProducts.map((product, index) => {
            const originalPrice = product.priceRange?.max ?? product.priceRange?.min ?? 0;
            const salePrice = product.priceRange?.min ?? originalPrice;
            const discount = product.discount?.value || 
              Math.round(((originalPrice - salePrice) / originalPrice) * 100);
            const hasDiscount = discount > 0;

            return (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <Link href={`/product/${product._id}`}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100"
                  >
                    {/* Sale Badge */}
                    {hasDiscount && (
                      <div className="absolute top-3 left-3 z-10">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg"
                        >
                          -{discount}%
                        </motion.div>
                      </div>
                    )}

                    {/* Emoji Placeholder */}
                    <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-50">
                      {product.images?.[0]?.url ? (
                        <Image
                          src={product.images[0].url}
                          alt={product.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-6xl opacity-50">{getEmoji(product.type)}</span>
                        </div>
                      )}
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      {/* Brand */}
                      {product.brand?.name && (
                        <p className="text-xs text-gray-500 mb-1 truncate">
                          {product.brand.name}
                        </p>
                      )}

                      {/* Name */}
                      <h3 className="font-bold text-gray-900 text-sm mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">
                        {product.name}
                      </h3>

                      {/* ABV */}
                      {product.abv && (
                        <p className="text-xs text-gray-400 mb-2">
                          {product.abv}% ABV
                        </p>
                      )}

                      {/* Price */}
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-red-600">
                          {formatPrice(salePrice)}
                        </span>
                        {hasDiscount && originalPrice > salePrice && (
                          <span className="text-sm text-gray-400 line-through">
                            {formatPrice(originalPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Show More/Less */}
        {saleProducts.length > 4 && (
          <div className="flex justify-center mt-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-6 py-3 bg-white border-2 border-red-200 text-red-600 rounded-full font-semibold text-sm hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <Icon.PiArrowsDownUp size={18} />
              {isExpanded ? 'Show Less' : `Show ${saleProducts.length - 4} More`}
            </motion.button>
          </div>
        )}
      </div>
    </section>
  );
};

export default OnSaleHighlight;
