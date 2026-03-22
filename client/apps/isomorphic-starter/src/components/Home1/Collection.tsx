'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import { motion, AnimatePresence } from 'framer-motion';
import { fallbackProducts } from '@/data/fallback-data';
import * as Icon from 'react-icons/pi';
import 'swiper/css';
import 'swiper/css/navigation';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  tagline?: string;
  featuredImage?: {
    url: string;
    alt?: string;
  };
  bannerImage?: {
    url: string;
    alt?: string;
  };
  thumbnailImage?: {
    url: string;
    alt?: string;
  };
  color?: string;
  icon?: string;
  productCount: number;
}

const fallbackCategories: Category[] = [
  {
    _id: '1',
    name: 'Whiskey',
    slug: 'whiskey',
    description: 'Single Malt & Blended',
    featuredImage: { url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&h=800&fit=crop', alt: 'Whiskey' },
    color: '#92400e',
    productCount: 124,
  },
  {
    _id: '2',
    name: 'Vodka',
    slug: 'vodka',
    description: 'Premium & Classic',
    featuredImage: { url: 'https://images.unsplash.com/photo-1572575626618-6a0b5d6fb858?w=600&h=800&fit=crop', alt: 'Vodka' },
    color: '#0ea5e9',
    productCount: 89,
  },
  {
    _id: '3',
    name: 'Champagne',
    slug: 'champagne',
    description: 'Sparkling & Brut',
    featuredImage: { url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&h=800&fit=crop', alt: 'Champagne' },
    color: '#facc15',
    productCount: 67,
  },
  {
    _id: '4',
    name: 'Beer',
    slug: 'beer',
    description: 'Craft & Premium',
    featuredImage: { url: 'https://images.unsplash.com/photo-1608879493122-e3876d490a0c?w=600&h=800&fit=crop', alt: 'Beer' },
    color: '#f97316',
    productCount: 156,
  },
  {
    _id: '5',
    name: 'Wine',
    slug: 'wine',
    description: 'Red, White & Rose',
    featuredImage: { url: 'https://images.unsplash.com/photo-1514218953589-2d7d37efd9dc?w=600&h=800&fit=crop', alt: 'Wine' },
    color: '#b91c1c',
    productCount: 203,
  },
  {
    _id: '6',
    name: 'Gin',
    slug: 'gin',
    description: 'London Dry & Premium',
    featuredImage: { url: 'https://images.unsplash.com/photo-1605218457336-98db6b9b7601?w=600&h=800&fit=crop', alt: 'Gin' },
    color: '#10b981',
    productCount: 45,
  },
  {
    _id: '7',
    name: 'Rum',
    slug: 'rum',
    description: 'Aged & Spiced',
    featuredImage: { url: 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=600&h=800&fit=crop', alt: 'Rum' },
    color: '#d97706',
    productCount: 78,
  },
  {
    _id: '8',
    name: 'Brandy',
    slug: 'brandy',
    description: 'Fine & VSOP',
    featuredImage: { url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=600&h=800&fit=crop', alt: 'Brandy' },
    color: '#c2410c',
    productCount: 52,
  },
];

const categoryEmojis: Record<string, string> = {
  whiskey: '🥃',
  vodka: '❄️',
  champagne: '🍾',
  beer: '🍺',
  wine: '🍷',
  gin: '🌿',
  rum: '🏴‍☠️',
  brandy: '🍷',
  tequila: '🌵',
  liqueur: '🍯',
  default: '🍹',
};

const categoryGradients: Record<string, { from: string; to: string }> = {
  whiskey: { from: 'from-amber-900', to: 'to-orange-900' },
  vodka: { from: 'from-sky-500', to: 'to-blue-700' },
  champagne: { from: 'from-yellow-400', to: 'to-amber-500' },
  beer: { from: 'from-orange-500', to: 'to-red-600' },
  wine: { from: 'from-red-700', to: 'to-rose-900' },
  gin: { from: 'from-emerald-500', to: 'to-teal-700' },
  rum: { from: 'from-amber-600', to: 'to-yellow-800' },
  brandy: { from: 'from-orange-700', to: 'to-red-800' },
  tequila: { from: 'from-lime-600', to: 'to-green-700' },
  liqueur: { from: 'from-purple-500', to: 'to-violet-700' },
  default: { from: 'from-gray-600', to: 'to-gray-800' },
};

const getCategoryGradient = (slug: string): { from: string; to: string } => {
  return categoryGradients[slug.toLowerCase()] || categoryGradients.default;
};

const getCategoryEmoji = (slug: string): string => {
  return categoryEmojis[slug.toLowerCase()] || categoryEmojis.default;
};

const CollectionCard = ({ category, index }: { category: Category; index: number }) => {
  const gradient = getCategoryGradient(category.slug);
  const emoji = getCategoryEmoji(category.slug);
  const displayImage = category.featuredImage?.url || category.bannerImage?.url;
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      whileHover={{ y: -6 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative"
    >
      <Link href={`/shop?type=${category.slug}`} className="block h-full">
        <motion.div
          animate={{
            boxShadow: isHovered 
              ? '0 30px 60px -15px rgba(0, 0, 0, 0.25)' 
              : '0 10px 20px -5px rgba(0, 0, 0, 0.1)'
          }}
          transition={{ duration: 0.3 }}
          className="relative rounded-2xl overflow-hidden bg-white border border-gray-100 h-full flex flex-col"
        >
          {/* Image Section */}
          <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50">
            {displayImage && !imgError ? (
              <>
                <img
                  src={displayImage}
                  alt={category.featuredImage?.alt || category.name}
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${isHovered ? 'scale-110' : 'scale-100'}`}
                  onError={() => setImgError(true)}
                />
                {/* Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t ${gradient} opacity-40 group-hover:opacity-50 transition-opacity duration-500`} />
              </>
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <span className="text-8xl opacity-40">{emoji}</span>
              </div>
            )}

            {/* Emoji Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: isHovered ? 1 : 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="absolute top-3 right-3"
            >
              <div className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl">{emoji}</span>
              </div>
            </motion.div>

            {/* Product Count Badge */}
            <div className="absolute top-3 left-3">
              <div className="px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-full shadow-md flex items-center gap-1.5">
                <Icon.PiPackage size={14} className="text-gray-600" />
                <span className="text-xs font-bold text-gray-700">{category.productCount || 0}</span>
              </div>
            </div>

            {/* Bottom Gradient */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent" />

            {/* Hover Shimmer */}
            {displayImage && !imgError && (
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: isHovered ? '100%' : '-100%' }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 pointer-events-none"
              />
            )}
          </div>

          {/* Content Section */}
          <div className="flex-1 p-4 flex flex-col justify-between bg-white">
            <div>
              {/* Category Name */}
              <h3 className="text-base font-bold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
                {category.name}
              </h3>

              {/* Description */}
              {category.description && (
                <p className="text-xs text-gray-500 line-clamp-2">
                  {category.description}
                </p>
              )}
            </div>

            {/* Explore Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: isHovered ? 1 : 0.7, y: 0 }}
              className="mt-4"
            >
              <div className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                isHovered 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <span>Explore</span>
                <motion.span
                  animate={{ x: isHovered ? [0, 4, 0] : 0 }}
                  transition={{ repeat: isHovered ? Infinity : 0, duration: 1.5 }}
                >
                  <Icon.PiArrowRight size={16} />
                </motion.span>
              </div>
            </motion.div>
          </div>

          {/* Accent Border */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className={`absolute bottom-0 left-0 right-0 h-1 origin-left rounded-b-xl bg-gradient-to-r ${gradient.from} ${gradient.to}`}
          />
        </motion.div>
      </Link>
    </motion.div>
  );
};

const FeaturedCollection = ({ category }: { category: Category }) => {
  const gradient = getCategoryGradient(category.slug);
  const emoji = getCategoryEmoji(category.slug);
  const displayImage = category.featuredImage?.url || category.bannerImage?.url;
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative rounded-3xl overflow-hidden h-[400px] sm:h-[450px] cursor-pointer group"
    >
      <Link href={`/shop?type=${category.slug}`} className="block h-full">
        {displayImage && !imgError ? (
          <>
            <img
              src={displayImage}
              alt={category.featuredImage?.alt || category.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${gradient.from} via-${gradient.from}/60 to-transparent`} />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-8xl opacity-30">{emoji}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{emoji}</span>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-white/80 text-sm">{category.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Icon.PiPackage size={16} />
              <span>{category.productCount || 0} products</span>
            </div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -10 }}
              className="flex items-center gap-2 bg-white text-gray-900 px-5 py-2.5 rounded-full font-bold text-sm shadow-lg"
            >
              Shop Now <Icon.PiArrowRight size={16} />
            </motion.div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const Collection = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${API_URL}/api/categories`);
        const data = await response.json();

        if (data.success && data.data?.categories?.length > 0) {
          const parentSlugs = ['whiskey', 'vodka', 'champagne', 'beer', 'wine', 'gin', 'rum', 'brandy', 'tequila', 'liqueur', 'red-wine', 'white-wine', 'rose-wine', 'sparkling-wine', 'scotch', 'bourbon', 'coffee', 'tea', 'juice', 'water', 'soft-drinks'];
          const parentCategories = data.data.categories.filter(
            (cat: any) => parentSlugs.includes(cat.slug)
          );
          setCategories(parentCategories);
        } else {
          setCategories(fallbackCategories);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories(fallbackCategories);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const featuredCategories = useMemo(() => {
    return categories.slice(0, 3);
  }, [categories]);

  const gridCategories = useMemo(() => {
    return categories.slice(3);
  }, [categories]);

  const totalProducts = useMemo(() => {
    return categories.reduce((sum, cat) => sum + (cat.productCount || 0), 0);
  }, [categories]);

  if (loading) {
    return (
      <div className="py-16 sm:py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full text-xs font-bold text-amber-700 mb-4">
              <Icon.PiSparkleFill size={14} />
              Featured Collection
            </div>
            <div className="h-12 bg-gray-200 rounded-xl w-64 mx-auto animate-pulse" />
            <div className="h-5 bg-gray-100 rounded w-96 mx-auto mt-3 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[400px] bg-gray-200 rounded-3xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-[4/5] bg-gray-200 rounded-3xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-white via-gray-50/50 to-white relative overflow-hidden">
      <div className="container mx-auto px-4">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 rounded-full text-xs font-bold text-amber-700 mb-4 shadow-sm"
          >
            <Icon.PiSparkleFill size={14} className="text-amber-500" />
            Curated Selection
          </motion.div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            Explore Our
            <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 bg-clip-text text-transparent"> Collections</span>
          </h2>
          
          <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto">
            Discover our premium selection of fine beverages, carefully curated for every taste and occasion
          </p>

          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2 text-gray-600">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <Icon.PiPackage size={18} className="text-amber-600" />
              </div>
              <div>
                <div className="font-bold text-gray-900">{categories.length}</div>
                <div className="text-xs text-gray-500">Categories</div>
              </div>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex items-center gap-2 text-gray-600">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                <Icon.PiStorefront size={18} className="text-emerald-600" />
              </div>
              <div>
                <div className="font-bold text-gray-900">{totalProducts.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Products</div>
              </div>
            </div>
          </div>
        </motion.div>

        {categories.length > 0 ? (
          <>
            {/* Featured Collections */}
            {featuredCategories.length > 0 && (
              <div className="mb-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {featuredCategories.map((category, index) => (
                    <FeaturedCollection key={category._id} category={category} />
                  ))}
                </div>
              </div>
            )}

            {/* All Collections Slider */}
            {gridCategories.length > 0 && (
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                    All Collections
                  </h3>
                  <Link
                    href="/shop"
                    className="text-sm font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors"
                  >
                    View All <Icon.PiArrowRight size={16} />
                  </Link>
                </div>

                <Swiper
                  spaceBetween={16}
                  slidesPerView={2}
                  loop={gridCategories.length > 4}
                  speed={600}
                  modules={[Autoplay, Pagination, Navigation]}
                  autoplay={{
                    delay: 3500,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true
                  }}
                  navigation={{
                    prevEl: '.collection-slider-prev',
                    nextEl: '.collection-slider-next'
                  }}
                  breakpoints={{
                    320: { slidesPerView: 2, spaceBetween: 12 },
                    480: { slidesPerView: 3, spaceBetween: 14 },
                    640: { slidesPerView: 4, spaceBetween: 16 },
                    900: { slidesPerView: 5, spaceBetween: 20 },
                    1200: { slidesPerView: 6, spaceBetween: 24 },
                  }}
                  className="collection-slider pb-12"
                >
                  {gridCategories.map((category, index) => (
                    <SwiperSlide key={category._id}>
                      <CollectionCard category={category} index={index} />
                    </SwiperSlide>
                  ))}
                </Swiper>

                {/* Navigation Arrows */}
                <motion.button
                  whileHover={{ scale: 1.1, x: -3 }}
                  whileTap={{ scale: 0.95 }}
                  className="collection-slider-prev absolute -left-3 top-[45%] -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-xl shadow-gray-200/50 flex items-center justify-center text-gray-700 hover:text-gray-900 hover:shadow-2xl transition-all hidden lg:flex"
                >
                  <Icon.PiCaretLeft size={18} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1, x: 3 }}
                  whileTap={{ scale: 0.95 }}
                  className="collection-slider-next absolute -right-3 top-[45%] -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-xl shadow-gray-200/50 flex items-center justify-center text-gray-700 hover:text-gray-900 hover:shadow-2xl transition-all hidden lg:flex"
                >
                  <Icon.PiCaretRight size={18} />
                </motion.button>
              </div>
            )}

            {/* CTA Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mt-16"
            >
              <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-8 sm:p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10" />
                <div className="relative">
                  <h3 className="text-2xl sm:text-3xl font-black text-white mb-3">
                    Can't Find What You're Looking For?
                  </h3>
                  <p className="text-gray-400 mb-6 max-w-lg mx-auto">
                    Browse our complete collection or use our AI assistant to find the perfect drink
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link
                      href="/shop"
                      className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-full font-bold hover:bg-gray-100 transition-all shadow-lg"
                    >
                      <Icon.PiStorefront size={18} />
                      Browse All
                    </Link>
                    <Link
                      href="/chat"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-full font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg"
                    >
                      <Icon.PiChatCircle size={18} />
                      Ask AI
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon.PiPackage size={40} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Collections Found</h3>
            <p className="text-gray-500">Check back soon for our curated collections</p>
          </div>
        )}
      </div>

      {/* Slider Styles */}
      <style jsx global>{`
        .collection-slider .swiper-pagination {
          bottom: 0 !important;
        }
        .collection-slider .swiper-pagination-bullet {
          width: 8px;
          height: 8px;
          background: #d1d5db;
          opacity: 1;
          transition: all 0.3s ease;
        }
        .collection-slider .swiper-pagination-bullet-active {
          width: 24px;
          border-radius: 4px;
          background: linear-gradient(to right, #f59e0b, #ea580c);
        }
        .collection-slider .swiper-button-disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>
    </section>
  );
};

export default Collection;
