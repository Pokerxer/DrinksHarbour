'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface CategoryBannerProps {
  categorySlug?: string;
  placement?: string;
  layout?: 'hero' | 'card' | 'minimal' | 'sidebar';
  showSubcategories?: boolean;
  showStats?: boolean;
  limit?: number;
}

interface CategoryDetails {
  _id: string;
  name: string;
  slug: string;
  type?: string;
  displayName?: string;
  tagline?: string;
  description?: string;
  icon?: string;
  color?: string;
  bannerImage?: {
    url: string;
    alt?: string;
  };
  stats?: {
    productCount?: number;
    activeProductCount?: number;
    viewCount?: number;
  };
  subcategories?: Array<{
    _id: string;
    name: string;
    slug: string;
    icon?: string;
    color?: string;
    tagline?: string;
    stats?: {
      productCount?: number;
    };
  }>;
}

interface FallbackCategory {
  name: string;
  slug: string;
  icon: string;
  color: string;
  productCount: number;
  subcategories: Array<{ name: string; slug: string; icon?: string }>;
}

const fallbackCategories: Record<string, FallbackCategory> = {
  whiskey: {
    name: 'Whiskey',
    slug: 'whiskey',
    icon: '🥃',
    color: '#92400E',
    productCount: 156,
    subcategories: [
      { name: 'Scotch', slug: 'scotch', icon: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
      { name: 'Bourbon', slug: 'bourbon', icon: '🇺🇸' },
      { name: 'Irish', slug: 'irish', icon: '🇮🇪' },
      { name: 'Japanese', slug: 'japanese', icon: '🇯🇵' }
    ]
  },
  wine: {
    name: 'Wine',
    slug: 'wine',
    icon: '🍷',
    color: '#7C3AED',
    productCount: 243,
    subcategories: [
      { name: 'Red', slug: 'red', icon: '🔴' },
      { name: 'White', slug: 'white', icon: '⚪' },
      { name: 'Rosé', slug: 'rose', icon: '🌸' },
      { name: 'Sparkling', slug: 'sparkling', icon: '✨' }
    ]
  },
  beer: {
    name: 'Beer',
    slug: 'beer',
    icon: '🍺',
    color: '#F59E0B',
    productCount: 189,
    subcategories: [
      { name: 'Lager', slug: 'lager', icon: '🥛' },
      { name: 'IPA', slug: 'ipa', icon: '🌿' },
      { name: 'Stout', slug: 'stout', icon: '⚫' },
      { name: 'Wheat', slug: 'wheat', icon: '🌾' }
    ]
  },
  vodka: {
    name: 'Vodka',
    slug: 'vodka',
    icon: '🌾',
    color: '#3B82F6',
    productCount: 98,
    subcategories: [
      { name: 'Premium', slug: 'premium', icon: '👑' },
      { name: 'Flavored', slug: 'flavored', icon: '🍓' },
      { name: 'Economy', slug: 'economy', icon: '💰' }
    ]
  },
  gin: {
    name: 'Gin',
    slug: 'gin',
    icon: '🌿',
    color: '#10B981',
    productCount: 67,
    subcategories: [
      { name: 'London Dry', slug: 'london-dry', icon: '🇬🇧' },
      { name: 'Botanical', slug: 'botanical', icon: '🌸' },
      { name: 'Old Tom', slug: 'old-tom', icon: '📜' }
    ]
  },
  rum: {
    name: 'Rum',
    slug: 'rum',
    icon: '甘蔗',
    color: '#F97316',
    productCount: 112,
    subcategories: [
      { name: 'White', slug: 'white', icon: '⚪' },
      { name: 'Aged', slug: 'aged', icon: '🪵' },
      { name: 'Spiced', slug: 'spiced', icon: '🌶️' }
    ]
  },
  brandy: {
    name: 'Brandy',
    slug: 'brandy',
    icon: '🍇',
    color: '#8B5CF6',
    productCount: 45,
    subcategories: [
      { name: 'Cognac', slug: 'cognac', icon: '🇫🇷' },
      { name: 'Armagnac', slug: 'armagnac', icon: '🇫🇷' },
      { name: 'Fruit', slug: 'fruit', icon: '🍎' }
    ]
  },
  tequila: {
    name: 'Tequila',
    slug: 'tequila',
    icon: '🌵',
    color: '#84CC16',
    productCount: 78,
    subcategories: [
      { name: 'Blanco', slug: 'blanco', icon: '⚪' },
      { name: 'Reposado', slug: 'reposado', icon: '🪵' },
      { name: 'Añejo', slug: 'anejo', icon: '🏺' }
    ]
  },
  cocktails: {
    name: 'Cocktails',
    slug: 'cocktails',
    icon: '🍸',
    color: '#EC4899',
    productCount: 234,
    subcategories: [
      { name: 'Classic', slug: 'classic', icon: '📜' },
      { name: 'Modern', slug: 'modern', icon: '🎨' },
      { name: 'Ready to Drink', slug: 'ready-to-drink', icon: '🥫' }
    ]
  },
  spirits: {
    name: 'Spirits',
    slug: 'spirits',
    icon: '🥃',
    color: '#DC2626',
    productCount: 456,
    subcategories: [
      { name: 'Whiskey', slug: 'whiskey', icon: '🥃' },
      { name: 'Vodka', slug: 'vodka', icon: '🌾' },
      { name: 'Gin', slug: 'gin', icon: '🌿' }
    ]
  }
};

const defaultFallback: FallbackCategory = {
  name: 'All Products',
  slug: 'all',
  icon: '🛒',
  color: '#6366F1',
  productCount: 1000,
  subcategories: []
};

const CategoryBanner: React.FC<CategoryBannerProps> = ({
  categorySlug,
  placement = 'category_top',
  layout = 'hero',
  showSubcategories = true,
  showStats = true
}) => {
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallbackData, setFallbackData] = useState<FallbackCategory>(defaultFallback);

  useEffect(() => {
    const fetchCategoryData = async () => {
      setLoading(true);
      
      // Use fallback data immediately
      if (categorySlug) {
        const fallback = fallbackCategories[categorySlug.toLowerCase()];
        if (fallback) {
          setFallbackData(fallback);
        }
      }
      
      // Try to fetch from API
      if (categorySlug) {
        try {
          const response = await fetch(`http://localhost:5001/api/products/categories/slug/${categorySlug}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setCategoryDetails(data.data);
            }
          }
        } catch (err) {
          console.log('Using fallback data for category:', categorySlug);
        }
      }
      
      setLoading(false);
    };

    fetchCategoryData();
  }, [categorySlug]);

  const getCategoryColor = (color?: string) => {
    const colors: Record<string, string> = {
      beer: '#F59E0B',
      wine: '#7C3AED',
      spirits: '#DC2626',
      whisky: '#92400E',
      vodka: '#3B82F6',
      gin: '#10B981',
      rum: '#F97316',
      brandy: '#8B5CF6',
      cognac: '#F59E0B',
      tequila: '#84CC16',
      cocktails: '#EC4899',
      mixers: '#06B6D4',
      'non-alcoholic': '#22C55E',
    };
    
    return color || colors[categorySlug || ''] || fallbackData.color;
  };

  const displayColor = getCategoryColor(categoryDetails?.color);
  const displayIcon = categoryDetails?.icon || fallbackData.icon;
  const displayName = categoryDetails?.name || fallbackData.name;
  const displayTagline = categoryDetails?.tagline || fallbackData.name;
  const productCount = categoryDetails?.stats?.activeProductCount || categoryDetails?.stats?.productCount || fallbackData.productCount;
  const subcategories = categoryDetails?.subcategories || fallbackData.subcategories;
  const displayImage = categoryDetails?.bannerImage?.url;

  const bgGradient = `linear-gradient(135deg, ${displayColor}20 0%, ${displayColor}05 100%)`;
  const borderColor = `${displayColor}30`;
  const textColor = displayColor;

  if (loading) {
    return (
      <div className={`w-full ${layout === 'sidebar' ? 'h-[300px]' : 'h-[200px] md:h-[300px]'} animate-pulse bg-gray-200 rounded-xl`}></div>
    );
  }

  // Sidebar Layout
  if (layout === 'sidebar') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative h-[300px] rounded-xl overflow-hidden"
      >
        {displayImage ? (
          <>
            <Image
              src={displayImage}
              alt={displayName}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/50 to-transparent"></div>
          </>
        ) : (
          <div 
            className="absolute inset-0"
            style={{ background: bgGradient }}
          ></div>
        )}

        <div className="relative z-10 p-4 h-full flex flex-col justify-end">
          {displayIcon && (
            <span className="text-3xl mb-2">{displayIcon}</span>
          )}
          <h3 className="text-white font-bold text-lg mb-1">{displayName}</h3>
          {showStats && productCount > 0 && (
            <p className="text-white/70 text-sm">{productCount} Products</p>
          )}
          <Link
            href={`/shop?category=${categorySlug || fallbackData.slug}`}
            className="mt-3 inline-flex items-center gap-1 text-white/90 text-sm font-medium hover:text-white"
          >
            Shop Now
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </motion.div>
    );
  }

  // Hero Layout
  if (layout === 'hero') {
    return (
      <section className="w-full py-6">
        <div 
          className="relative rounded-xl overflow-hidden h-[200px] md:h-[350px] lg:h-[400px]"
          style={{ 
            background: displayImage 
              ? undefined 
              : bgGradient
          }}
        >
          {displayImage && (
            <>
              <Image
                src={displayImage}
                alt={displayName}
                fill
                className="object-cover"
                priority
              />
              <div 
                className="absolute inset-0"
                style={{ 
                  background: `linear-gradient(to right, ${displayColor}dd, ${displayColor}44)`
                }}
              ></div>
            </>
          )}

          <div className="relative z-10 h-full container mx-auto px-6 md:px-10 flex items-start justify-start">
            <div className="max-w-xl pt-8 md:pt-16">
              {/* Category Icon & Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 mb-4"
              >
                {displayIcon && (
                  <div 
                    className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
                    style={{ border: '2px solid rgba(255,255,255,0.3)' }}
                  >
                    <span className="text-2xl md:text-3xl">{displayIcon}</span>
                  </div>
                )}
                <span className="text-white/80 text-sm font-medium uppercase tracking-wider">
                  {displayTagline}
                </span>
              </motion.div>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-white text-3xl md:text-5xl lg:text-6xl font-bold mb-3 leading-tight"
              >
                {displayName}
              </motion.h1>

              {/* Stats & CTA */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap items-center gap-4"
              >
                {showStats && productCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-bold">{productCount.toLocaleString()}</p>
                      <p className="text-white/60 text-xs">Products</p>
                    </div>
                  </div>
                )}

                <Link
                  href={`/shop?category=${categorySlug || fallbackData.slug}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-all duration-300"
                >
                  Shop Now
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </motion.div>
            </div>
          </div>

          {/* Subcategories */}
          {showSubcategories && subcategories.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full px-4"
            >
              <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
                {subcategories.slice(0, 8).map((sub) => (
                  <Link
                    key={sub.slug}
                    href={`/shop?subcategory=${sub.slug}`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm hover:bg-white/30 transition-all duration-300"
                  >
                    {sub.icon && <span>{sub.icon}</span>}
                    <span className="font-medium">{sub.name}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>
    );
  }

  // Card Layout
  if (layout === 'card') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-xl overflow-hidden h-[180px] md:h-[220px]"
        style={{ 
          background: displayImage 
            ? undefined 
            : bgGradient
        }}
      >
        {displayImage && (
          <>
            <Image
              src={displayImage}
              alt={displayName}
              fill
              className="object-cover transition-transform duration-500 hover:scale-105"
            />
            <div 
              className="absolute inset-0"
              style={{ 
                background: `linear-gradient(to top, ${displayColor}ee, ${displayColor}22 60%, transparent)`
              }}
            ></div>
          </>
        )}

        <div className="relative z-10 p-5 md:p-6 h-full flex flex-col justify-end">
          {displayIcon && (
            <span className="text-3xl md:text-4xl mb-2">{displayIcon}</span>
          )}
          
          <h3 className="text-white font-bold text-xl md:text-2xl mb-1">
            {displayName}
          </h3>

          {showStats && productCount > 0 && (
            <p className="text-white/70 text-sm mb-2">{productCount} Products</p>
          )}

          <Link
            href={`/shop?category=${categorySlug || fallbackData.slug}`}
            className="inline-flex items-center gap-1 text-white/90 text-sm font-medium hover:text-white"
          >
            Shop Now
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </motion.div>
    );
  }

  // Minimal Layout (Default)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-lg overflow-hidden h-[120px] md:h-[150px]"
      style={{ 
        background: bgGradient,
        border: `1px solid ${borderColor}`
      }}
    >
      <div className="absolute inset-0 opacity-5" style={{ 
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>

      <div className="relative z-10 p-4 md:p-5 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          {displayIcon && (
            <span className="text-2xl">{displayIcon}</span>
          )}
          <div>
            <h3 className="text-gray-900 font-semibold">{displayName}</h3>
            {showStats && productCount > 0 && (
              <p className="text-gray-500 text-sm">{productCount} items</p>
            )}
          </div>
        </div>

        <Link
          href={`/shop?category=${categorySlug || fallbackData.slug}`}
          className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </motion.div>
  );
};

export default CategoryBanner;
