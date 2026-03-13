'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import 'swiper/css';
import 'swiper/css/navigation';

// Interface matching the server response
interface BrandLogo {
  url: string;
  publicId?: string;
  alt?: string;
  width?: number;
  height?: number;
  format?: string;
}

interface BrandLogoVariants {
  primary?: string;
  secondary?: string;
  white?: string;
  black?: string;
  icon?: string;
}

interface Brand {
  _id: string;
  name: string;
  slug: string;
  logo?: BrandLogo;
  logoVariants?: BrandLogoVariants;
  featuredImage?: BrandLogo;
  bannerImage?: BrandLogo;
  gallery?: BrandLogo[];
  brandColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  description?: string;
  shortDescription?: string;
  productCount?: number;
  countryOfOrigin?: string;
  primaryCategory?: string;
  brandType?: string;
  founded?: number;
  isFeatured?: boolean;
  isPremium?: boolean;
  verified?: boolean;
  popularityScore?: number;
  createdAt?: string;
}

const Brand: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

  useEffect(() => {
    setIsVisible(true);
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/brands?limit=12&status=active`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(data.data.brands)

      if (data.success && data.data?.brands && Array.isArray(data.data.brands)) {
        if (data.data.brands.length > 0) {
          setBrands(data.data.brands);
        } else {
          console.log('No brands found in API');
          setBrands([]);
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      setError('Failed to load brands');
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const getBrandImage = (brand: Brand): string | null => {
    // Priority: logo.url > logoVariants.primary > logoVariants.white > featuredImage.url
    return brand.logo?.url || 
           brand.logoVariants?.primary || 
           brand.logoVariants?.white ||
           brand.featuredImage?.url || 
           null;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getBrandColor = (brand: Brand): string => {
    return brand.brandColors?.primary || brand.brandColors?.accent || '#3B82F6';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <section className="py-16 md:py-24 relative overflow-hidden bg-gradient-to-b from-white via-gray-50/50 to-white">
      {/* Background Decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            x: [0, 50, 0],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-0 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -50, 0],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isVisible ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium mb-4"
          >
            <Icon.PiCrown size={16} className="text-amber-500" />
            Premium Brands
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4"
          >
            Trusted by Leading{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900">
              Brands
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={isVisible ? { opacity: 1 } : {}}
            transition={{ delay: 0.4 }}
            className="text-gray-500 text-lg max-w-2xl mx-auto"
          >
            We partner with the world&apos;s finest beverage brands to bring you authentic quality
          </motion.p>
        </motion.div>

        {/* Brands Carousel */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          className="relative"
        >
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-[140px] animate-pulse"
                >
                  <div className="w-full h-12 bg-gray-200 rounded mb-3" />
                  <div className="w-20 h-4 bg-gray-200 rounded mx-auto" />
                </motion.div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Icon.PiWarning size={48} className="text-red-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchBrands}
                className="px-6 py-2 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : brands.length === 0 ? (
            <div className="text-center py-12">
              <Icon.PiPackage size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No brands available at the moment</p>
            </div>
          ) : (
            <>
              <Swiper
                spaceBetween={24}
                slidesPerView={2}
                loop={brands.length > 4}
                speed={600}
                modules={[Autoplay, Pagination, Navigation]}
                autoplay={{
                  delay: 3000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true
                }}
                navigation={{
                  prevEl: '.brand-prev',
                  nextEl: '.brand-next'
                }}
                breakpoints={{
                  320: { slidesPerView: 2, spaceBetween: 16 },
                  500: { slidesPerView: 3, spaceBetween: 20 },
                  680: { slidesPerView: 4, spaceBetween: 24 },
                  992: { slidesPerView: 5, spaceBetween: 24 },
                  1200: { slidesPerView: 6, spaceBetween: 32 },
                }}
                className="brand-swiper pb-8"
              >
                {brands.map((brand, index) => {
                  const brandImage = getBrandImage(brand);
                  const brandColor = getBrandColor(brand);
                  const isHovered = hoveredBrand === brand._id;

                  return (
                    <SwiperSlide key={brand._id}>
                      <motion.div
                        variants={itemVariants}
                        className="relative group"
                        onMouseEnter={() => setHoveredBrand(brand._id)}
                        onMouseLeave={() => setHoveredBrand(null)}
                      >
                        <Link
                          href={`/shop?brand=${encodeURIComponent(brand.name)}`}
                          className="block relative"
                        >
                          <motion.div
                            whileHover={{ y: -8, scale: 1.02 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-300 flex flex-col items-center justify-center min-h-[140px]"
                          >
                            {/* Brand Image/Logo */}
                            <div className="relative w-full h-14 flex items-center justify-center mb-3">
                              {brandImage ? (
                                <motion.div
                                  animate={{
                                    scale: isHovered ? 1.1 : 1,
                                    filter: isHovered ? 'grayscale(0%)' : 'grayscale(100%)'
                                  }}
                                  transition={{ duration: 0.3 }}
                                  className="relative w-full h-full"
                                >
                                  <Image
                                    src={brandImage}
                                    alt={brand.name}
                                    fill
                                    className="object-contain"
                                    sizes="(max-width: 500px) 50vw, (max-width: 680px) 33vw, (max-width: 992px) 25vw, 16vw"
                                    onError={(e) => {
                                      // Hide image on error, will show initials fallback
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </motion.div>
                              ) : (
                                <motion.div
                                  animate={{
                                    scale: isHovered ? 1.1 : 1,
                                    rotate: isHovered ? [0, -5, 5, 0] : 0
                                  }}
                                  transition={{ duration: 0.5 }}
                                  className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white"
                                  style={{ backgroundColor: brandColor }}
                                >
                                  {getInitials(brand.name)}
                                </motion.div>
                              )}
                            </div>

                            {/* Brand Name */}
                            <motion.h3
                              className="text-sm font-semibold text-gray-800 text-center line-clamp-1 group-hover:text-gray-900 transition-colors"
                            >
                              {brand.name}
                            </motion.h3>

                            {/* Brand Info */}
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{
                                opacity: isHovered ? 1 : 0,
                                y: isHovered ? 0 : 10
                              }}
                              className="flex flex-col items-center mt-2 space-y-1"
                            >
                              {brand.countryOfOrigin && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Icon.PiGlobe size={12} />
                                  {brand.countryOfOrigin}
                                </span>
                              )}
                              {brand.founded && (
                                <span className="text-xs text-gray-400">
                                  Est. {brand.founded}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {brand.productCount || 0} products
                              </span>
                            </motion.div>

                            {/* Hover Glow Effect */}
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: isHovered ? 1 : 0 }}
                              className="absolute inset-0 rounded-2xl -z-10"
                              style={{
                                background: `linear-gradient(135deg, ${brandColor}10 0%, ${brandColor}05 100%)`
                              }}
                            />

                            {/* Premium Badge */}
                            {brand.isPremium && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute top-2 left-2"
                              >
                                <Icon.PiCrown size={16} className="text-amber-500" />
                              </motion.div>
                            )}

                            {/* Verified Badge */}
                            {brand.verified && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute top-2 right-8"
                              >
                                <Icon.PiSealCheck size={16} className="text-blue-500" />
                              </motion.div>
                            )}

                            {/* Corner Arrow */}
                            <motion.div
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{
                                opacity: isHovered ? 1 : 0,
                                scale: isHovered ? 1 : 0
                              }}
                              className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: brandColor }}
                            >
                              <Icon.PiArrowUpRight size={14} className="text-white" />
                            </motion.div>
                          </motion.div>
                        </Link>
                      </motion.div>
                    </SwiperSlide>
                  );
                })}
              </Swiper>

              {/* Custom Navigation Arrows */}
              <motion.button
                whileHover={{ scale: 1.1, x: -3 }}
                whileTap={{ scale: 0.95 }}
                className="brand-prev absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg shadow-gray-200/50 flex items-center justify-center text-gray-700 hover:text-gray-900 hover:shadow-xl transition-all hidden lg:flex"
              >
                <Icon.PiArrowLeft size={18} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1, x: 3 }}
                whileTap={{ scale: 0.95 }}
                className="brand-next absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg shadow-gray-200/50 flex items-center justify-center text-gray-700 hover:text-gray-900 hover:shadow-xl transition-all hidden lg:flex"
              >
                <Icon.PiArrowRight size={18} />
              </motion.button>
            </>
          )}
        </motion.div>

        {/* View All Brands CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8 }}
          className="text-center mt-12"
        >
          <Link href="/shop">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
            >
              Browse All Brands
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Icon.PiArrowRight size={18} />
              </motion.span>
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default Brand;
