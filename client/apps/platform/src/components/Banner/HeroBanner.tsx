'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence, Variants, useReducedMotion } from 'framer-motion';

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
  const reduceMotion = useReducedMotion();
  // Respect prefers-reduced-motion: no auto-advancing, parallax, or blur wipes.
  const effectiveAutoPlay = autoPlay && !reduceMotion;

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

  // Cinematic transition — layered parallax (dolly) + rack-focus + light-wipe
  // Background, gradient, and text move at different parallax depths. When the
  // visitor prefers reduced motion we collapse every layer to a simple opacity
  // cross-fade with no transform, scale, or blur.
  const slideVariants = reduceMotion
    ? { enter: { opacity: 0 }, center: { zIndex: 1, opacity: 1 }, exit: { zIndex: 0, opacity: 0 } }
    : {
        enter:  (d: number) => ({ opacity: 0, scale: 1.18, filter: 'blur(14px)' }),
        center: { zIndex: 1, opacity: 1, scale: 1, filter: 'blur(0px)' },
        exit:   (d: number) => ({ zIndex: 0, opacity: 0, scale: 0.94, filter: 'blur(12px)' }),
      };

  // Parallax depth layers — background drifts opposite to foreground
  const bgParallaxVariants: Variants = reduceMotion
    ? { enter: {}, center: {}, exit: {} }
    : {
        enter:  (d: number) => ({ x: d > 0 ? '6%' : '-6%', scale: 1.18 }),
        center: { x: '0%', scale: 1.08 },
        exit:   (d: number) => ({ x: d < 0 ? '6%' : '-6%', scale: 1.14 }),
      };

  // Gradient/light layer — drifts slower (midground) + a directional light-wipe opacity
  const midParallaxVariants: Variants = reduceMotion
    ? { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        enter:  (d: number) => ({ x: d > 0 ? '3%' : '-3%', opacity: 0 }),
        center: { x: '0%', opacity: 1 },
        exit:   (d: number) => ({ x: d < 0 ? '3%' : '-3%', opacity: 0 }),
      };

  // Staggered text entrance — badge → title → desc → CTA → pills
  const containerVariants: Variants = {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { staggerChildren: reduceMotion ? 0 : 0.12, delayChildren: reduceMotion ? 0 : 0.3 } },
    exit:    { opacity: 1, transition: { staggerChildren: reduceMotion ? 0 : 0.035, staggerDirection: -1 } },
  };

  const textVariants: Variants = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial:  { y: 36, opacity: 0, filter: 'blur(10px)' },
        animate:  { y: 0, opacity: 1, filter: 'blur(0px)', transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
        exit:     { y: -22, opacity: 0, filter: 'blur(8px)', transition: { duration: 0.4, ease: [0.4, 0, 1, 1] } },
      };

  const btnVariants: Variants = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial:  { scale: 0.82, opacity: 0, y: 18, filter: 'blur(6px)' },
        animate:  { scale: 1, opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.34, 1.56, 0.64, 1] } },
      };

  // Auto-advance
  useEffect(() => {
    if (!effectiveAutoPlay || slides.length <= 1 || isPaused || loading) return;
    const interval = slides[currentIndex]?.autoplay?.interval || 6000;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex(p => (p + 1) % slides.length);
    }, interval);
    return () => clearInterval(timer);
  }, [effectiveAutoPlay, slides, currentIndex, isPaused, loading]);

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
    if (style === 'primary')   return 'bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white shadow-lg shadow-red-900/40 ring-1 ring-amber-400/30';
    if (style === 'secondary') return 'bg-white/12 backdrop-blur-md border border-amber-300/35 text-white hover:bg-white/22 shadow-[0_2px_18px_rgba(245,176,66,0.18)]';
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
      role="region"
      aria-roledescription="carousel"
      aria-label="Promotional banners"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.div
          key={slide._id}
          custom={direction}
          role="group"
          aria-roledescription="slide"
          aria-label={`${currentIndex + 1} of ${slides.length}: ${slide.title}`}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            opacity: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
            scale: { duration: 1.1, ease: [0.16, 1, 0.3, 1] },
            filter: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
          }}
          className="absolute inset-0"
        >
          {/* Background — deepest parallax layer (background image) */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              custom={direction}
              variants={bgParallaxVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 90, damping: 28, mass: 1.4 },
                scale: { duration: 1.3, ease: [0.16, 1, 0.3, 1] },
              }}
              className="absolute inset-0"
            >
              <Image
                src={imgSrc}
                alt={slide.image.alt || slide.title}
                fill
                className="object-cover"
                priority
                sizes="100vw"
                onError={() => setImgErrors(p => ({ ...p, [slide._id]: true }))}
              />
            </motion.div>
            {/* Dark overlay */}
            {(slide.overlayOpacity ?? 0) > 0 && (
              <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${(slide.overlayOpacity ?? 0) / 100})` }} />
            )}
          </div>

          {/* Midground — gradient + vignette drift at mid-depth (slower parallax) */}
          <motion.div
            custom={direction}
            variants={midParallaxVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 120, damping: 30, mass: 1 },
              opacity: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
            }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Cinematic golden-hour gradient — warm depth-of-field treatment */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(110deg, ${slide.backgroundColor || '#1A1A2E'}f2 0%, ${slide.backgroundColor || '#1A1A2E'}b3 32%, ${slide.backgroundColor || '#1A1A2E'}40 60%, transparent 78%), radial-gradient(ellipse at 78% 28%, rgba(245, 176, 66, 0.22) 0%, transparent 45%), linear-gradient(to top, ${slide.backgroundColor || '#1A1A2E'}e6 0%, transparent 38%)`,
              }}
            />
            {/* Cinematic vignette for depth-of-field feel */}
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.42) 100%)',
              }}
            />
            {/* Light-wipe sweep — directional light bleed that fades with the slide */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(${direction > 0 ? 105 : 255}deg, transparent 40%, rgba(245,176,66,0.10) 55%, transparent 72%)`,
              }}
            />
          </motion.div>

          {/* Content */}
          <div className={`relative z-10 container mx-auto px-5 md:px-10 h-full flex ${contentPos(slide.contentPosition)}`}>
            <motion.div
              variants={containerVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className={`max-w-2xl ${textAlign(slide.textAlignment || 'left')}`}
            >

              {/* Badge */}
              {slide.subtitle && (
                <motion.div variants={textVariants} className="mb-4">
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400/12 backdrop-blur-md rounded-full text-sm font-semibold text-amber-100 border border-amber-300/25 shadow-[0_2px_12px_rgba(245,176,66,0.18)]">
                    <Icon.PiSparkleFill className="text-amber-300" size={13} />
                    {slide.subtitle}
                  </span>
                </motion.div>
              )}

              {/* Title — Kavoon display for cinematic hero presence */}
              <motion.h2
                variants={textVariants}
                className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white mb-4 leading-[1.05] tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)]"
                style={{ fontFamily: "var(--font-kavoon), 'Kavoon', serif" }}
              >
                {slide.title}
              </motion.h2>

              {/* Description */}
              {slide.description && (
                <motion.p
                  variants={textVariants}
                  className="text-base md:text-lg text-white/80 mb-8 max-w-lg leading-relaxed"
                >
                  {slide.description}
                </motion.p>
              )}

              {/* CTA */}
              {slide.ctaText && (
                <motion.div variants={btnVariants}>
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
                variants={textVariants}
                className="flex flex-wrap gap-3 mt-10"
              >
                {[
                  { icon: <Icon.PiTruck size={14} />, label: 'Free Delivery' },
                  { icon: <Icon.PiSealCheck size={14} />, label: 'Authentic Products' },
                  { icon: <Icon.PiLockKey size={14} />, label: 'Secure Checkout' },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2 px-4 py-2 bg-white/8 backdrop-blur-md rounded-full text-xs text-white/90 border border-white/12">
                    <span className="text-amber-300">{icon}</span>
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
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-13 md:h-13 rounded-full bg-black/30 backdrop-blur-md border border-amber-300/25 flex items-center justify-center text-white hover:bg-black/50 hover:border-amber-300/50 transition-all"
            aria-label="Previous slide"
          >
            <Icon.PiCaretLeft size={20} />
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-13 md:h-13 rounded-full bg-black/30 backdrop-blur-md border border-amber-300/25 flex items-center justify-center text-white hover:bg-black/50 hover:border-amber-300/50 transition-all"
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
              type="button"
              onClick={() => handleDotClick(i)}
              aria-label={`Go to slide ${i + 1} of ${slides.length}`}
              aria-current={i === currentIndex ? 'true' : undefined}
              className={`h-2 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-amber-400 w-7 shadow-[0_0_10px_rgba(245,176,66,0.6)]' : 'bg-white/35 hover:bg-white/60 w-2'}`}
            />
          ))}
        </div>
      )}

      {/* Progress bar — warm amber on brand red */}
      {effectiveAutoPlay && slides.length > 1 && !isPaused && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
          <motion.div
            key={`pb-${slide._id}`}
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-red-500"
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
