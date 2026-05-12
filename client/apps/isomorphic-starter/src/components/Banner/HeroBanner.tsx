'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence, Variants } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
  image: { url: string; alt?: string };
  animation?: { type: string; duration?: number; delay?: number };
  autoplay?: { enabled: boolean; interval?: number };
}

// Fallback slides shown when the API has no data yet
const FALLBACK_SLIDES: BannerData[] = [
  {
    _id: 'fallback-1',
    title: 'Premium Spirits, Delivered',
    subtitle: 'New Arrivals',
    description: 'Explore our curated selection of world-class whiskeys, wines, and more — straight to your door.',
    type: 'hero',
    placement: 'home_hero',
    ctaText: 'Shop Now',
    ctaLink: '/shop',
    ctaStyle: 'primary',
    backgroundColor: '#1A1A2E',
    image: { url: '/images/images/product/1000x1000.png', alt: 'DrinksHarbour' },
  },
  {
    _id: 'fallback-2',
    title: 'Weekend Flash Sale',
    subtitle: 'Up to 40% Off',
    description: 'Limited time deals on premium bottles. Stock up before they\'re gone.',
    type: 'hero',
    placement: 'home_hero',
    ctaText: 'View Deals',
    ctaLink: '/shop?sale=true',
    ctaStyle: 'primary',
    backgroundColor: '#7C1D1D',
    image: { url: '/images/images/product/1000x1000.png', alt: 'Sale' },
  },
];

const HeroBanner: React.FC<HeroBannerProps> = ({
  placement = 'home_hero',
  limit = 5,
  autoPlay = true,
  showControls = true,
  showIndicators = true,
}) => {
  const [banners, setBanners]       = useState<BannerData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [direction, setDirection]   = useState(0);
  const [isPaused, setIsPaused]     = useState(false);
  const [imgErrors, setImgErrors]   = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/banners/placement/${placement}?limit=${limit}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setBanners(data.data);
        }
      } catch {
        // use fallbacks
      } finally {
        setLoading(false);
      }
    };
    fetchBanners();
  }, [placement, limit]);

  const slides = banners.length > 0 ? banners : FALLBACK_SLIDES;

  const slideVariants = {
    enter:  (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0, scale: 1.04 }),
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
    exit:   (d: number) => ({ zIndex: 0, x: d < 0 ? '100%' : '-100%', opacity: 0, scale: 0.96 }),
  };

  const textVariants: Variants = {
    initial:  { y: 28, opacity: 0 },
    animate:  { y: 0, opacity: 1, transition: { duration: 0.55, ease: 'easeOut' } },
    exit:     { y: -20, opacity: 0, transition: { duration: 0.3 } },
  };

  const btnVariants: Variants = {
    initial:  { scale: 0.82, opacity: 0 },
    animate:  { scale: 1, opacity: 1, transition: { delay: 0.38, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] } },
  };

  // Auto-advance
  useEffect(() => {
    if (!autoPlay || slides.length <= 1 || isPaused || loading) return;
    const interval = slides[currentIndex]?.autoplay?.interval || 6000;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex(p => (p + 1) % slides.length);
    }, interval);
    return () => clearInterval(timer);
  }, [autoPlay, slides, currentIndex, isPaused, loading]);

  const handleNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex(p => (p + 1) % slides.length);
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex(p => (p - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const handleDotClick = (i: number) => {
    setDirection(i > currentIndex ? 1 : -1);
    setCurrentIndex(i);
  };

  const trackClick = async (id: string) => {
    if (!id || id.startsWith('fallback')) return;
    try { await fetch(`${API_URL}/api/banners/${id}/click`, { method: 'POST' }); } catch {}
  };

  const contentPos = (p = 'center') => ({
    'top-left': 'items-start justify-start', 'top-center': 'items-start justify-center', 'top-right': 'items-start justify-end',
    'center-left': 'items-center justify-start', center: 'items-center justify-center', 'center-right': 'items-center justify-end',
    'bottom-left': 'items-end justify-start', 'bottom-center': 'items-end justify-center', 'bottom-right': 'items-end justify-end',
  }[p] ?? 'items-center justify-center');

  const textAlign = (a = 'center') => ({ left: 'text-left', right: 'text-right', center: 'text-center' }[a] ?? 'text-center');

  const ctaClass = (style = 'primary') => {
    if (style === 'primary')   return 'bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white shadow-lg shadow-red-900/30';
    if (style === 'secondary') return 'bg-white/15 backdrop-blur-sm border border-white/30 text-white hover:bg-white/25';
    return 'bg-transparent text-white hover:underline';
  };

  if (loading) {
    return (
      <div className="relative w-full h-[70vh] min-h-[500px] max-h-[800px] bg-[#1A1A2E] overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-red-700/30 border-t-red-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const slide = slides[currentIndex];
  const imgSrc = imgErrors[slide._id] ? '/images/images/product/1000x1000.png' : slide.image.url;

  return (
    <div
      className="relative w-full h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={slide._id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ x: { type: 'spring', stiffness: 280, damping: 28 }, opacity: { duration: 0.35 }, scale: { duration: 0.35 } }}
          className="absolute inset-0"
        >
          {/* Background */}
          <div className="absolute inset-0">
            <Image
              src={imgSrc}
              alt={slide.image.alt || slide.title}
              fill
              className="object-cover"
              priority
              sizes="100vw"
              onError={() => setImgErrors(p => ({ ...p, [slide._id]: true }))}
            />
            {/* Dark overlay */}
            {(slide.overlayOpacity ?? 0) > 0 && (
              <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${(slide.overlayOpacity ?? 0) / 100})` }} />
            )}
            {/* Edge gradient */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right, ${slide.backgroundColor || '#1A1A2E'}e0 0%, ${slide.backgroundColor || '#1A1A2E'}55 45%, transparent 70%), linear-gradient(to top, ${slide.backgroundColor || '#1A1A2E'}88 0%, transparent 35%)`,
              }}
            />
          </div>

          {/* Content */}
          <div className={`relative z-10 container mx-auto px-5 md:px-10 h-full flex ${contentPos(slide.contentPosition)}`}>
            <motion.div className={`max-w-2xl ${textAlign(slide.textAlignment || 'left')}`}>

              {/* Badge */}
              {slide.subtitle && (
                <motion.div variants={textVariants} initial="initial" animate="animate" exit="exit" className="mb-4">
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-semibold text-white/90 border border-white/15">
                    <Icon.PiSparkleFill className="text-amber-400" size={13} />
                    {slide.subtitle}
                  </span>
                </motion.div>
              )}

              {/* Title */}
              <motion.h1
                variants={textVariants} initial="initial" animate="animate" exit="exit"
                className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white mb-4 leading-tight tracking-tight"
              >
                {slide.title}
              </motion.h1>

              {/* Description */}
              {slide.description && (
                <motion.p
                  variants={textVariants} initial="initial" animate="animate" exit="exit"
                  transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
                  className="text-base md:text-lg text-white/75 mb-8 max-w-lg leading-relaxed"
                >
                  {slide.description}
                </motion.p>
              )}

              {/* CTA */}
              {slide.ctaText && (
                <motion.div variants={btnVariants} initial="initial" animate="animate">
                  {slide.linkType === 'external' ? (
                    <a
                      href={slide.ctaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackClick(slide._id)}
                      className={`inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm transition-all duration-300 ${ctaClass(slide.ctaStyle)}`}
                    >
                      {slide.ctaText} <Icon.PiArrowRight size={16} />
                    </a>
                  ) : (
                    <Link
                      href={slide.ctaLink || '#'}
                      onClick={() => trackClick(slide._id)}
                      className={`inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm transition-all duration-300 ${ctaClass(slide.ctaStyle)}`}
                    >
                      {slide.ctaText} <Icon.PiArrowRight size={16} />
                    </Link>
                  )}
                </motion.div>
              )}

              {/* Trust pills */}
              <motion.div
                variants={textVariants} initial="initial" animate="animate" exit="exit"
                transition={{ delay: 0.55, duration: 0.5, ease: 'easeOut' }}
                className="flex flex-wrap gap-3 mt-10"
              >
                {[
                  { icon: <Icon.PiTruck size={14} />, label: 'Free Delivery' },
                  { icon: <Icon.PiSealCheck size={14} />, label: 'Authentic Products' },
                  { icon: <Icon.PiLockKey size={14} />, label: 'Secure Checkout' },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-xs text-white/85 border border-white/10">
                    <span className="text-red-400">{icon}</span>
                    {label}
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Nav arrows */}
      {showControls && slides.length > 1 && (
        <>
          <motion.button
            initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-13 md:h-13 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            aria-label="Previous slide"
          >
            <Icon.PiCaretLeft size={20} />
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-13 md:h-13 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            aria-label="Next slide"
          >
            <Icon.PiCaretRight size={20} />
          </motion.button>
        </>
      )}

      {/* Dots */}
      {showIndicators && slides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDotClick(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-white w-7' : 'bg-white/40 hover:bg-white/65 w-2'}`}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {autoPlay && slides.length > 1 && !isPaused && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
          <motion.div
            key={`pb-${slide._id}`}
            className="h-full bg-gradient-to-r from-red-600 to-red-400"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: (slides[currentIndex]?.autoplay?.interval || 6000) / 1000, ease: 'linear' }}
          />
        </div>
      )}
    </div>
  );
};

export default HeroBanner;
