'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

interface BannerData {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: string;
  placement: string;
  priority: string;
  ctaText?: string;
  ctaLink?: string;
  ctaStyle?: string;
  backgroundColor?: string;
  textColor?: string;
  overlayOpacity?: number;
  textAlignment?: string;
  contentPosition?: string;
  image: {
    url: string;
    alt?: string;
  };
  mobileImage?: {
    url: string;
    alt?: string;
  };
  startDate?: string;
  endDate?: string;
  tags?: string[];
}

interface PromotionalSliderProps {
  placement?: string;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showControls?: boolean;
  showIndicators?: boolean;
  showCountdown?: boolean;
  columns?: number;
}

const defaultPromotionalBanners: BannerData[] = [
  {
    id: '1',
    title: 'Premium Wines',
    description: 'Discover our exclusive collection of world-class wines',
    url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200',
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['wine', 'premium', 'discount']
  },
  {
    id: '2',
    title: 'Craft Beer Selection',
    description: 'Artisan brews from around the world',
    url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=1200',
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['beer', 'craft', 'sale']
  },
  {
    id: '3',
    title: 'Luxury Champagne',
    description: 'Celebrate with premium champagnes',
    url: 'https://images.unsplash.com/photo-1572575626618-6a0b5d6fb858?w=1200',
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['champagne', 'luxury', 'gift']
  }
];

const CountdownTimer = ({ endDate }: { endDate?: string }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetDate = endDate ? new Date(endDate) : new Date(Date.now() + 48 * 60 * 60 * 1000);

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance < 0) {
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  return (
      <div className="flex items-center gap-2 mt-3">
      <div className="flex items-center gap-1">
        {[
          { value: timeLeft.hours, label: 'H' },
          { value: timeLeft.minutes, label: 'M' },
          { value: timeLeft.seconds, label: 'S' }
        ].map((item, idx) => (
          <div key={item.label} className="flex flex-col items-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 min-w-[50px] text-center">
              <span className="text-white font-bold text-xl">{String(item.value).padStart(2, '0')}</span>
            </div>
            {idx < 2 && <span className="text-white/60 text-xs mt-0.5">{item.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

const PromotionalSlider: React.FC<PromotionalSliderProps> = ({
  placement = 'home_promo',
  autoPlay = true,
  autoPlayInterval = 5000,
  showControls = true,
  showIndicators = true,
  showCountdown = true
}) => {
  const [banners, setBanners] = useState<BannerData[]>(defaultPromotionalBanners);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5001/api/banners/placement/${placement}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.length > 0) {
            setBanners(data.data);
          }
        }
      } catch (err) {
        console.log('Using default promotional banners');
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [placement]);

  useEffect(() => {
    if (!isAutoPlaying || banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [isAutoPlaying, banners.length, autoPlayInterval]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    setIsAutoPlaying(false);
  }, [banners.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
    setIsAutoPlaying(false);
  }, [banners.length]);

  const extractDiscount = (title: string): { value: string; type: string } => {
    const percentageMatch = title.match(/(\d+)%/);
    if (percentageMatch) {
      return { value: percentageMatch[1], type: 'percentage' };
    }
    if (title.toLowerCase().includes('buy') && title.toLowerCase().includes('get')) {
      return { value: 'BOGO', type: 'bogo' };
    }
    if (title.toLowerCase().includes('free')) {
      return { value: 'FREE', type: 'free' };
    }
    return { value: 'SALE', type: 'general' };
  };

  const getDiscountStyle = (discount: { value: string; type: string }) => {
    const styles: Record<string, { bg: string; border: string }> = {
      percentage: { bg: 'bg-red-500', border: 'border-red-600' },
      bogo: { bg: 'bg-green-500', border: 'border-green-600' },
      free: { bg: 'bg-purple-500', border: 'border-purple-600' },
      general: { bg: 'bg-orange-500', border: 'border-orange-600' }
    };
    return styles[discount.type] || styles.general;
  };

  const handleBannerClick = async (bannerId: string) => {
    if (!bannerId) return;
    try {
      await fetch(`http://localhost:5001/api/banners/${bannerId}/click`, { method: 'POST' });
    } catch (err) {
      // Ignore click tracking errors
    }
  };

  if (loading) {
    return (
      <div className="relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden bg-gray-200 animate-pulse" />
    );
  }

  if (banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];
  const discount = extractDiscount(currentBanner.title);
  const discountStyle = getDiscountStyle(discount);
  const imageUrl = currentBanner.mobileImage?.url || currentBanner.image?.url || '/images/placeholder-product.png';
  const isTextLeft = currentBanner.contentPosition?.includes('left');
  const isTextRight = currentBanner.contentPosition?.includes('right');

  return (
    <section className="promotional-slider relative w-full">
      <div className="relative h-[350px] md:h-[450px] lg:h-[500px] rounded-2xl overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBanner._id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0">
              <Image
                src={imgError ? '/images/placeholder-product.png' : imageUrl}
                alt={currentBanner.image?.alt || currentBanner.title || 'Promotional banner'}
                fill
                className="object-cover"
                priority
                sizes="100vw"
                onError={() => setImgError(true)}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to top, ${currentBanner.backgroundColor || '#1A1A2E'}dd 0%, ${currentBanner.backgroundColor || '#1A1A2E'}44 50%, transparent 100%)`
                }}
              />
            </div>

            <div className={`relative z-10 h-full container mx-auto px-4 md:px-8 flex flex-col justify-center ${
              isTextRight ? 'items-end text-right' :
              isTextLeft ? 'items-start text-left' :
              'items-center text-center'
            }`}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-2xl"
              >
                {discount.value !== 'SALE' && (
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className={`inline-flex ${discountStyle.bg} ${discountStyle.border} border-2 text-white px-6 py-3 rounded-xl font-black text-3xl shadow-lg mb-4`}
                  >
                    {discount.value}{discount.type === 'percentage' ? '%' : ''}
                    {discount.type === 'bogo' && <span className="text-xl ml-1">BOGO</span>}
                    {discount.type === 'free' && <span className="text-xl ml-1">FREE</span>}
                  </motion.div>
                )}

                {currentBanner.subtitle && (
                  <span className="inline-flex items-center gap-2 text-white/80 text-sm font-semibold uppercase tracking-wider mb-3">
                    {currentBanner.priority === 'urgent' && <Icon.PiFireFill size={16} className="text-orange-400 animate-pulse" />}
                    {currentBanner.subtitle}
                  </span>
                )}

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-white text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight"
                >
                  {currentBanner.title}
                </motion.h2>

                {currentBanner.description && (
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-white/80 text-lg md:text-xl mb-6 max-w-xl"
                  >
                    {currentBanner.description}
                  </motion.p>
                )}

                {showCountdown && currentBanner.priority === 'urgent' && (
                  <CountdownTimer endDate={currentBanner.endDate} />
                )}

                {currentBanner.ctaText && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-6"
                  >
                    <Link
                      href={currentBanner.ctaLink || '#'}
                      onClick={() => handleBannerClick(currentBanner._id)}
                      className={`inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 ${
                        currentBanner.ctaStyle === 'primary'
                          ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-xl'
                          : currentBanner.ctaStyle === 'secondary'
                          ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-xl'
                          : 'border-2 border-white text-white hover:bg-white hover:text-gray-900'
                      }`}
                    >
                      {currentBanner.ctaText}
                      <Icon.PiArrowRight size={20} />
                    </Link>
                  </motion.div>
                )}

                {currentBanner.tags && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className={`flex flex-wrap gap-2 mt-6 ${isTextLeft ? 'justify-start' : isTextRight ? 'justify-end' : 'justify-center'}`}
                  >
                    {currentBanner.tags.slice(0, 4).map((tag, i) => (
                      <span key={i} className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-white/70 text-sm">
                        #{tag}
                      </span>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {showControls && banners.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all shadow-lg"
              aria-label="Previous slide"
            >
              <Icon.PiCaretLeft size={24} />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all shadow-lg"
              aria-label="Next slide"
            >
              <Icon.PiCaretRight size={24} />
            </button>
          </>
        )}

        {showIndicators && banners.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 md:w-3 md:h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-white w-8'
                    : 'bg-white/40 hover:bg-white/60'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}

        {currentBanner.priority === 'urgent' && (
          <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2 shadow-lg">
            <Icon.PiFireFill size={16} className="animate-pulse" />
            Limited Time
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3 mt-4">
        {(banners || []).map((banner, index) => (
          <motion.div
            key={banner._id || `banner-${index}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: index === currentIndex ? 1 : 0.4, scale: index === currentIndex ? 1 : 0.9 }}
            className="relative w-16 h-12 md:w-20 md:h-14 rounded-lg overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-white/50 transition-all"
            onClick={() => goToSlide(index)}
          >
            <Image
              src={banner.image?.url || '/images/placeholder-product.png'}
              alt={banner.title || 'Banner'}
              fill
              className="object-cover"
              sizes="100px"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/images/placeholder-product.png';
              }}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default PromotionalSlider;
