'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface OnSaleProduct {
  _id: string;
  slug?: string;
  name: string;
  type: string;
  images?: { url: string }[];
  primaryImage?: { url: string };
  priceRange?: { min: number; max: number };
  discount?: { value: number; percentage?: number; type?: string };
  availableAt?: Array<{
    isOnSale?: boolean;
    saleType?: string;
    saleDiscountValue?: number;
    saleStartDate?: string;
    saleEndDate?: string;
    discount?: { value: number; type?: string; startDate?: string; endDate?: string };
    priceRange?: { min: number; max: number };
    sizes?: Array<{
      pricing?: { websitePrice?: number; originalWebsitePrice?: number };
    }>;
  }>;
  brand?: { name: string };
  abv?: number;
}

interface OnSaleHighlightProps {
  products: OnSaleProduct[];
}

const OnSaleHighlight: React.FC<OnSaleHighlightProps> = ({ products }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isDiscountActive = (discount: any): boolean => {
    if (!discount || !discount.value) return false;
    const now = new Date();
    if (discount.startDate && now < new Date(discount.startDate)) return false;
    if (discount.endDate && now > new Date(discount.endDate)) return false;
    return true;
  };

  const saleProducts = useMemo(() => {
    return products.filter(p =>
      p.availableAt?.some((v) => {
        if (!v.isOnSale) return false;
        const hasDiscountValue = v.saleDiscountValue > 0;
        const hasActiveDiscount = v.discount?.value > 0 && isDiscountActive(v.discount);
        if (!hasDiscountValue && !hasActiveDiscount) return false;
        // Check if sale dates are valid
        const now = new Date();
        if (v.saleStartDate && now < new Date(v.saleStartDate)) return false;
        if (v.saleEndDate && now > new Date(v.saleEndDate)) return false;
        // Confirm real price reduction in computed sizing
        return v.sizes?.some(s => {
          const original = s.pricing?.originalWebsitePrice ?? 0;
          const current = s.pricing?.websitePrice ?? 0;
          return original > current;
        });
      })
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
            // Use server-computed pricing from first on-sale availableAt entry
            const saleEntry = product.availableAt?.find(v => v.isOnSale);
            const firstSize = saleEntry?.sizes?.[0];
            const sizeDiscount = firstSize?.discount || saleEntry?.discount || {};
            
            // Use server-computed values directly
            const currentPrice = firstSize?.pricing?.websitePrice ?? product.priceRange?.min ?? 0;
            const originalPrice = firstSize?.pricing?.originalWebsitePrice ?? currentPrice;
            const saleType = saleEntry?.saleType || sizeDiscount.type || 'percentage';
            const hasDiscount = sizeDiscount.hasDiscount || (originalPrice > currentPrice && currentPrice > 0);
            const fixedAmountOff = sizeDiscount.savings || (hasDiscount ? Math.round(originalPrice - currentPrice) : 0);
            const discountPct = sizeDiscount.percentage || (hasDiscount ? Math.round((1 - currentPrice / originalPrice) * 100) : 0);
            const salePrice = currentPrice;
            
            // Determine badge style based on sale type
            const isFlashSale = saleType === 'flash_sale';
            const isFixed = saleType === 'fixed';

            return (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <Link href={`/product/${product.slug || product._id}`}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100"
                  >
                    {/* Sale Badge - Different styles for percentage, fixed, and flash sale */}
                    {hasDiscount && (
                      <div className="absolute top-2 left-2 z-10">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`px-2 py-1 text-white text-[10px] font-bold rounded-full shadow flex items-center gap-0.5 ${
                            isFlashSale 
                              ? 'bg-gradient-to-r from-orange-500 to-red-500 animate-pulse' 
                              : isFixed 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                                : 'bg-gradient-to-r from-red-500 to-pink-500'
                          }`}
                        >
                          {isFlashSale && <Icon.PiLightningFill size={9} className="inline" />}
                          {isFixed ? (
                            <>₦{fixedAmountOff.toLocaleString()}</>
                          ) : (
                            <>{discountPct}% OFF</>
                          )}
                        </motion.div>
                      </div>
                    )}

                    {/* Emoji Placeholder */}
                    <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-50">
                      {(product.primaryImage?.url || product.images?.[0]?.url) ? (
                        <Image
                          src={product.primaryImage?.url || product.images![0].url}
                          alt={product.name}
                          fill
                          className="object-contain group-hover:scale-105 transition-transform duration-500"
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-red-600">
                          {formatPrice(salePrice)}
                        </span>
                        {hasDiscount && (
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
