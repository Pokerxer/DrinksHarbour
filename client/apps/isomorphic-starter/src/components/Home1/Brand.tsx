'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import 'swiper/css';
import 'swiper/css/navigation';

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

interface BrandCardProps {
  brand: Brand;
  onHover: (id: string | null) => void;
  isHovered: boolean;
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const getBrandImage = (brand: Brand): string | null => {
  return brand.logo?.url || 
         brand.logoVariants?.primary || 
         brand.logoVariants?.white ||
         brand.featuredImage?.url || 
         null;
};

const getBrandColor = (brand: Brand): string => {
  return brand.brandColors?.primary || brand.brandColors?.accent || '#6366F1';
};

const getCountryEmoji = (country?: string): string => {
  if (!country) return '';
  const countryMap: Record<string, string> = {
    'France': '🇫🇷',
    'Italy': '🇮🇹',
    'USA': '🇺🇸',
    'United States': '🇺🇸',
    'UK': '🇬🇧',
    'United Kingdom': '🇬🇧',
    'Germany': '🇩🇪',
    'Spain': '🇪🇸',
    'Mexico': '🇲🇽',
    'Japan': '🇯🇵',
    'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'Ireland': '🇮🇪',
    'Australia': '🇦🇺',
    'Canada': '🇨🇦',
    'Nigeria': '🇳🇬',
    'South Africa': '🇿🇦',
  };
  return countryMap[country] || countryMap[country.split(',')[0].trim()] || '🌍';
};

const BrandCard: React.FC<BrandCardProps> = ({ brand, onHover, isHovered }) => {
  const brandImage = getBrandImage(brand);
  const brandColor = getBrandColor(brand);
  const countryEmoji = getCountryEmoji(brand.countryOfOrigin);

  return (
    <Link href={`/shop?brand=${encodeURIComponent(brand.name)}`} className="block h-full">
      <motion.div
        onMouseEnter={() => onHover(brand._id)}
        onMouseLeave={() => onHover(null)}
        whileHover={{ y: -8 }}
        animate={{
          boxShadow: isHovered 
            ? `0 25px 50px -12px ${brandColor}40, 0 0 0 1px ${brandColor}20` 
            : '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative bg-white rounded-2xl overflow-hidden cursor-pointer h-full flex flex-col border border-gray-100"
      >
        {/* Hero Banner */}
        <div 
          className="relative h-24 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${brandColor}20 0%, ${brandColor}05 50%, ${brandColor}10 100%)`
          }}
        >
          {/* Animated Gradient Overlay */}
          <motion.div
            animate={{
              background: isHovered 
                ? [
                    `radial-gradient(circle at 20% 50%, ${brandColor}30 0%, transparent 50%)`,
                    `radial-gradient(circle at 80% 50%, ${brandColor}30 0%, transparent 50%)`,
                    `radial-gradient(circle at 20% 50%, ${brandColor}30 0%, transparent 50%)`
                  ]
                : `radial-gradient(circle at 50% 50%, ${brandColor}20 0%, transparent 60%)`
            }}
            transition={{ duration: 2, repeat: isHovered ? Infinity : 0 }}
            className="absolute inset-0"
          />

          {/* Abstract Pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id={`dots-${brand._id}`} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill={brandColor} />
              </pattern>
            </defs>
            <rect width="100" height="100" fill={`url(#dots-${brand._id})`} />
          </svg>

          {/* Top Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            {brand.isPremium && (
              <motion.div
                initial={{ scale: 0, x: -20 }}
                animate={{ scale: 1, x: 0 }}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 rounded-full shadow-lg backdrop-blur-sm"
              >
                <Icon.PiCrown size={12} className="text-white" />
                <span className="text-[11px] font-bold text-white">Premium</span>
              </motion.div>
            )}
            {brand.verified && (
              <motion.div
                initial={{ scale: 0, x: -20 }}
                animate={{ scale: 1, x: 0 }}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full shadow-lg backdrop-blur-sm"
              >
                <Icon.PiSealCheck size={12} className="text-white" />
                <span className="text-[11px] font-bold text-white">Verified</span>
              </motion.div>
            )}
          </div>

          {/* Logo Circle */}
          <motion.div
            animate={{
              scale: isHovered ? 1.1 : 1,
              y: isHovered ? -4 : 0
            }}
            transition={{ duration: 0.3 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 w-20 h-20 rounded-full bg-white shadow-xl border-4 border-white flex items-center justify-center overflow-hidden z-20"
          >
            {brandImage ? (
              <Image
                src={brandImage}
                alt={brand.name}
                fill
                className="object-contain p-2"
                sizes="80px"
              />
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center text-xl font-black text-white"
                style={{ backgroundColor: brandColor }}
              >
                {getInitials(brand.name)}
              </div>
            )}
          </motion.div>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col items-center px-4 pt-8 pb-4 text-center">
          {/* Brand Name */}
          <motion.h3 
            animate={{ y: isHovered ? -2 : 0 }}
            className="text-base font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors"
          >
            {brand.name}
          </motion.h3>

          {/* Country & Year */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-4">
            {countryEmoji && (
              <span className="text-base leading-none">{countryEmoji}</span>
            )}
            <span>{brand.countryOfOrigin || 'Worldwide'}</span>
            {brand.founded && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-gray-400">Est. {brand.founded}</span>
              </>
            )}
          </div>

          {/* Stats Bar */}
          <div className="w-full flex items-center justify-center gap-4 py-2 px-4 bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5">
              <Icon.PiWine size={14} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-700">{brand.productCount || 0}</span>
              <span className="text-xs text-gray-400">products</span>
            </div>
            {brand.popularityScore && (
              <>
                <div className="w-px h-4 bg-gray-200" />
                <div className="flex items-center gap-1">
                  <Icon.PiStar size={14} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-semibold text-gray-700">{brand.popularityScore}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 pb-4"
        >
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative overflow-hidden rounded-xl font-bold text-sm flex items-center justify-center gap-2 py-3 transition-all duration-300"
            style={{
              background: isHovered 
                ? `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)` 
                : 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
              color: isHovered ? 'white' : '#374151',
              boxShadow: isHovered ? `0 10px 20px -5px ${brandColor}40` : 'none'
            }}
          >
            {/* Shine Effect */}
            <motion.div
              initial={{ x: '-100%', rotate: 25 }}
              animate={{ x: isHovered ? '150%' : '-100%' }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
            
            <span className="relative z-10 flex items-center gap-2">
              Explore Collection
              <motion.span
                animate={{ x: isHovered ? [0, 4, 0] : 0 }}
                transition={{ repeat: isHovered ? Infinity : 0, duration: 1 }}
              >
                <Icon.PiArrowRight size={16} />
              </motion.span>
            </span>
          </motion.div>
        </motion.div>

        {/* Corner Decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute top-0 right-0 w-16 h-16 overflow-hidden"
        >
          <div 
            className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20"
            style={{ backgroundColor: brandColor }}
          />
        </motion.div>
      </motion.div>
    </Link>
  );
};

const Brand: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
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

      if (data.success && data.data?.brands && Array.isArray(data.data.brands)) {
        setBrands(data.data.brands);
      } else {
        setBrands([]);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      setError('Failed to load brands');
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-gray-50" />

      {/* Animated Orbs */}
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, 30, 0],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-10 -left-10 w-80 h-80 bg-gradient-to-br from-indigo-200/30 to-purple-200/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          x: [0, -20, 0],
          opacity: [0.15, 0.35, 0.15]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute -bottom-10 -right-10 w-96 h-96 bg-gradient-to-tl from-amber-200/25 to-rose-200/15 rounded-full blur-3xl"
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-full text-sm font-semibold mb-6 shadow-sm border border-indigo-100"
          >
            <motion.span
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
            >
              <Icon.PiCrown size={16} className="text-amber-500" />
            </motion.span>
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Our Partners
            </span>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-5"
          >
            World-Class
            <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600">
              Beverage Partners
            </span>
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 text-lg md:text-xl max-w-xl mx-auto mb-8"
          >
            Discover our curated selection from the most prestigious distilleries, vineyards, and breweries worldwide
          </motion.p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-8 flex-wrap"
          >
            {[
              { value: brands.length.toString() || '12+', label: 'Partner Brands', icon: <Icon.PiWine size={18} className="text-indigo-500" /> },
              { value: '20+', label: 'Countries', icon: <Icon.PiGlobe size={18} className="text-emerald-500" /> },
              { value: '500+', label: 'Premium Products', icon: <Icon.PiStar size={18} className="text-amber-500" /> },
            ].map((stat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {stat.icon}
                <span className="text-2xl font-black text-gray-900">{stat.value}</span>
                <span className="text-sm text-gray-500">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Slider */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          {loading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex-shrink-0 w-[200px] bg-white rounded-2xl p-6 animate-pulse border border-gray-100"
                >
                  <div className="w-full h-14 bg-gray-200 rounded-xl mb-3" />
                  <div className="w-16 h-4 bg-gray-200 rounded mx-auto" />
                </motion.div>
              ))}
            </div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 bg-white rounded-3xl border border-gray-100"
            >
              <Icon.PiWarningCircle size={56} className="text-red-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">{error}</p>
              <p className="text-gray-400 text-sm mb-4">Please try again later</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchBrands}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-colors"
              >
                Try Again
              </motion.button>
            </motion.div>
          ) : brands.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon.PiPackage size={36} className="text-gray-400" />
              </div>
              <p className="text-gray-500">No brands available at the moment</p>
              <p className="text-gray-400 text-sm mt-1">Check back soon for our partner brands</p>
            </motion.div>
          ) : (
            <>
              <Swiper
                spaceBetween={20}
                slidesPerView={2}
                loop={brands.length > 4}
                speed={800}
                modules={[Autoplay, Pagination, Navigation]}
                autoplay={{
                  delay: 3000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true
                }}
                navigation={{
                  prevEl: '.brand-slider-prev',
                  nextEl: '.brand-slider-next'
                }}
                breakpoints={{
                  320: { slidesPerView: 2, spaceBetween: 12 },
                  480: { slidesPerView: 3, spaceBetween: 16 },
                  640: { slidesPerView: 4, spaceBetween: 20 },
                  900: { slidesPerView: 5, spaceBetween: 20 },
                  1200: { slidesPerView: 6, spaceBetween: 24 },
                }}
                className="brand-slider pb-12"
              >
                {brands.map((brand) => (
                  <SwiperSlide key={brand._id}>
                    <BrandCard
                      brand={brand}
                      onHover={setHoveredBrand}
                      isHovered={hoveredBrand === brand._id}
                    />
                  </SwiperSlide>
                ))}
              </Swiper>

              {/* Navigation Arrows */}
              <motion.button
                whileHover={{ scale: 1.1, x: -3 }}
                whileTap={{ scale: 0.95 }}
                className="brand-slider-prev absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full shadow-xl shadow-gray-200/50 flex items-center justify-center text-gray-700 hover:text-gray-900 hover:shadow-2xl transition-all hidden md:flex"
              >
                <Icon.PiCaretLeft size={20} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1, x: 3 }}
                whileTap={{ scale: 0.95 }}
                className="brand-slider-next absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full shadow-xl shadow-gray-200/50 flex items-center justify-center text-gray-700 hover:text-gray-900 hover:shadow-2xl transition-all hidden md:flex"
              >
                <Icon.PiCaretRight size={20} />
              </motion.button>
            </>
          )}
        </motion.div>

        {/* View All CTA */}
        {!loading && brands.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <motion.a
              href="/shop"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 text-white font-bold rounded-full shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.8 }}
              />
              <Icon.PiStorefront size={22} className="relative z-10" />
              <span className="relative z-10">Explore All Brands</span>
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="relative z-10"
              >
                <Icon.PiArrowRight size={20} />
              </motion.span>
            </motion.a>

            <p className="text-gray-400 text-sm mt-4">
              Join thousands of customers who trust our brand partners
            </p>
          </motion.div>
        )}
      </div>

      {/* Custom Styles */}
      <style jsx global>{`
        .brand-slider .swiper-pagination {
          bottom: 0 !important;
        }
        .brand-slider .swiper-pagination-bullet {
          width: 8px;
          height: 8px;
          background: #d1d5db;
          opacity: 1;
          transition: all 0.3s ease;
        }
        .brand-slider .swiper-pagination-bullet-active {
          width: 24px;
          border-radius: 4px;
          background: linear-gradient(to right, #6366f1, #a855f7);
        }
        .brand-slider .swiper-button-disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>
    </section>
  );
};

export default Brand;
