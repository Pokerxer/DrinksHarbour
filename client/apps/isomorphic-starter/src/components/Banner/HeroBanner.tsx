'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence, Variants } from 'framer-motion';

interface HeroBannerProps {
  placement?: string;
  limit?: number;
  autoPlay?: boolean;
  showControls?: boolean;
  showIndicators?: boolean;
}

interface BannerData {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: string;
  placement: string;
  ctaText?: string;
  ctaLink?: string;
  ctaStyle?: string;
  linkType?: string;
  backgroundColor?: string;
  textColor?: string;
  overlayOpacity?: number;
  textAlignment?: string;
  contentPosition?: string;
  image: {
    url: string;
    alt?: string;
  };
  animation?: {
    type: string;
    duration?: number;
    delay?: number;
  };
  autoplay?: {
    enabled: boolean;
    interval?: number;
  };
}

const HeroBanner: React.FC<HeroBannerProps> = ({
  placement = 'home_hero',
  limit = 5,
  autoPlay = true,
  showControls = true,
  showIndicators = true
}) => {
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true);
        setFetchError(null);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const response = await fetch(`${apiUrl}/api/banners/placement/${placement}?limit=${limit}`);

        if (!response.ok) {
          setFetchError(`Server returned ${response.status}`);
          return;
        }

        const data = await response.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setBanners(data.data);
        } else {
          setFetchError(data.message || 'No banners found for this placement');
        }
      } catch (err: any) {
        setFetchError(err.message || 'Failed to fetch banners');
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [placement, limit]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 1.05,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.95,
    }),
  };

  const textVariants: Variants = {
    initial: {
      y: 30,
      opacity: 0,
    },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: 'easeOut' as const,
      },
    },
    exit: {
      y: -30,
      opacity: 0,
      transition: { duration: 0.4 },
    },
  };

  const buttonVariants: Variants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: {
      scale: 1,
      opacity: 1,
      transition: {
        delay: 0.4,
        duration: 0.5,
        ease: 'backOut' as const,
      },
    },
  };

  useEffect(() => {
    if (!autoPlay || banners.length <= 1 || isPaused) return;

    const currentBanner = banners[currentIndex];
    const interval = currentBanner?.autoplay?.enabled
      ? (currentBanner.autoplay.interval || 6000)
      : 6000;

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, interval);

    return () => clearInterval(timer);
  }, [autoPlay, banners, currentIndex, isPaused]);

  const handleNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const handleIndicatorClick = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const handleBannerClick = async (bannerId: string) => {
    if (!bannerId) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      await fetch(`${apiUrl}/api/banners/${bannerId}/click`, { method: 'POST' });
    } catch {
      // Ignore click tracking errors
    }
  };

  const getContentPosition = (position: string = 'center') => {
    const positions: Record<string, string> = {
      'top-left': 'items-start justify-start', 'top-center': 'items-start justify-center', 'top-right': 'items-start justify-end',
      'center-left': 'items-center justify-start', 'center': 'items-center justify-center', 'center-right': 'items-center justify-end',
      'bottom-left': 'items-end justify-start', 'bottom-center': 'items-end justify-center', 'bottom-right': 'items-end justify-end',
    };
    return positions[position] || 'items-center justify-center';
  };

  const getTextAlignment = (alignment: string = 'center') => {
    return alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center';
  };

  const getCTAStyle = (style: string = 'primary', isDark: boolean = false) => {
    if (style === 'primary') {
      return isDark 
        ? 'bg-white text-gray-900 hover:bg-gray-100' 
        : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg shadow-green-500/25';
    }
    if (style === 'secondary') {
      return 'bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30';
    }
    return 'bg-transparent text-white hover:underline';
  };

  if (loading) {
    return (
      <div className="relative w-full h-[70vh] min-h-[500px] max-h-[800px] bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
            <p className="text-white/70 text-sm">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (banners.length === 0) {
    if (process.env.NODE_ENV === 'development' && fetchError) {
      return (
        <div className="relative w-full h-[200px] bg-gray-800 flex items-center justify-center rounded-xl border border-red-500/30">
          <p className="text-red-400 text-sm font-mono px-4 text-center">
            HeroBanner: {fetchError}
          </p>
        </div>
      );
    }
    return null;
  }

  const currentBanner = banners[currentIndex];
  // Consider background dark if it has an overlay or a dark color is set
  const isDarkBg = (currentBanner.overlayOpacity ?? 0) > 20 || !currentBanner.backgroundColor || currentBanner.backgroundColor === '#ffffff';

  return (
    <div 
      className="relative w-full h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentBanner._id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.4 },
            scale: { duration: 0.4 },
          }}
          className="absolute inset-0"
        >
          {/* Background Image */}
          <div className="absolute inset-0">
            <Image
              src={imgErrors[currentBanner._id] ? '/images/images/product/1000x1000.png' : currentBanner.image.url}
              alt={currentBanner.image.alt || currentBanner.title}
              fill
              className="object-cover"
              priority
              sizes="100vw"
              onError={() => setImgErrors(prev => ({ ...prev, [currentBanner._id]: true }))}
            />
            {/* Dark overlay for text readability */}
            {(currentBanner.overlayOpacity ?? 0) > 0 && (
              <div
                className="absolute inset-0"
                style={{ backgroundColor: `rgba(0,0,0,${(currentBanner.overlayOpacity ?? 0) / 100})` }}
              />
            )}
            {/* Edge fade gradient for content contrast */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right, ${currentBanner.backgroundColor || '#1A1A2E'}cc 0%, transparent 55%), linear-gradient(to top, ${currentBanner.backgroundColor || '#1A1A2E'}88 0%, transparent 35%)`
              }}
            />
          </div>

          {/* Content */}
          <div className={`relative z-10 container mx-auto px-4 md:px-8 h-full flex ${getContentPosition(currentBanner.contentPosition)}`}>
            <motion.div 
              className={`max-w-2xl ${getTextAlignment(currentBanner.textAlignment || 'center')}`}
            >
              {/* Badge/Category */}
              <motion.div
                variants={textVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="mb-4"
              >
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium text-white/90">
                  <Icon.PiSparkleFill className="text-yellow-400" size={14} />
                  {currentBanner.subtitle}
                </span>
              </motion.div>

              {/* Title */}
              <motion.h1
                variants={textVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 leading-tight"
              >
                {currentBanner.title}
              </motion.h1>

              {/* Description */}
              {currentBanner.description && (
                <motion.p
                  variants={textVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="text-lg md:text-xl text-white/80 mb-8 max-w-lg leading-relaxed"
                >
                  {currentBanner.description}
                </motion.p>
              )}

              {/* CTA Button */}
              {currentBanner.ctaText && (
                <motion.div
                  variants={buttonVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {currentBanner.linkType === 'external' ? (
                    <a
                      href={currentBanner.ctaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleBannerClick(currentBanner._id)}
                      className={`inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold transition-all duration-300 ${getCTAStyle(currentBanner.ctaStyle, isDarkBg)}`}
                    >
                      {currentBanner.ctaText}
                      <Icon.PiArrowRight size={18} />
                    </a>
                  ) : (
                    <Link
                      href={currentBanner.ctaLink || '#'}
                      onClick={() => handleBannerClick(currentBanner._id)}
                      className={`inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold transition-all duration-300 ${getCTAStyle(currentBanner.ctaStyle, isDarkBg)}`}
                    >
                      {currentBanner.ctaText}
                      <Icon.PiArrowRight size={18} />
                    </Link>
                  )}
                </motion.div>
              )}

              {/* Features Pills */}
              <motion.div
                variants={textVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ delay: 0.6 }}
                className="flex flex-wrap gap-3 mt-10"
              >
                {['Free Delivery', 'Original Products', 'Secure Payment'].map((feature, index) => (
                  <div 
                    key={feature}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm text-white/90"
                  >
                    <Icon.PiCheckCircleFill className="text-green-400" size={16} />
                    {feature}
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      {showControls && banners.length > 1 && (
        <>
          <motion.button
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 hover:border-white/40 transition-all duration-300"
            aria-label="Previous slide"
          >
            <Icon.PiCaretLeft size={24} />
          </motion.button>
          
          <motion.button
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 hover:border-white/40 transition-all duration-300"
            aria-label="Next slide"
          >
            <Icon.PiCaretRight size={24} />
          </motion.button>
        </>
      )}

      {/* Indicators */}
      {showIndicators && banners.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
          {banners.map((_, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.2 }}
              onClick={() => handleIndicatorClick(index)}
              className={`relative group`}
              aria-label={`Go to slide ${index + 1}`}
            >
              <span className={`block w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-white w-8' 
                  : 'bg-white/40 hover:bg-white/70'
              }`} />
              {index === currentIndex && (
                <motion.span
                  layoutId="activeIndicator"
                  className="absolute inset-0 w-3 h-3 rounded-full border-2 border-white"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {autoPlay && banners.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
          <motion.div
            key={`progress-${currentBanner._id}`}
            className="h-full bg-gradient-to-r from-green-500 to-green-400"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ 
              duration: (banners[currentIndex]?.autoplay?.interval || 6000) / 1000, 
              ease: 'linear' 
            }}
          />
        </div>
      )}

      {/* Floating Elements */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute top-20 right-20 hidden xl:block z-10"
      >
        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-green-500/20 to-transparent blur-3xl" />
      </motion.div>
    </div>
  );
};

export default HeroBanner;
