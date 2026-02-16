'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

interface PromotionalBannerProps {
  placement?: string;
  layout?: 'card' | 'overlay' | 'split' | 'badge' | 'modern';
  showCountdown?: boolean;
  columns?: 1 | 2 | 3 | 4;
  variant?: 'default' | 'featured';
}

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

const defaultPromotionalBanners: BannerData[] = [
  {
    _id: '1',
    title: 'Premium Wines',
    subtitle: 'Exclusive Collection',
    description: 'Discover our exclusive collection of world-class wines',
    type: 'promotional',
    placement: 'home_secondary',
    priority: 'high',
    ctaText: 'Shop Now',
    ctaLink: '/shop?category=wine',
    ctaStyle: 'primary',
    backgroundColor: '#1A1A2E',
    image: {
      url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
      alt: 'Premium Wines'
    },
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['wine', 'premium', 'discount']
  },
  {
    _id: '2',
    title: 'Craft Beer Selection',
    subtitle: 'Artisan Brews',
    description: 'Artisan brews from around the world',
    type: 'promotional',
    placement: 'home_secondary',
    priority: 'urgent',
    ctaText: 'Explore',
    ctaLink: '/shop?category=beer',
    ctaStyle: 'primary',
    backgroundColor: '#2D1B0E',
    image: {
      url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800',
      alt: 'Craft Beer'
    },
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['beer', 'craft', 'sale']
  },
  {
    _id: '3',
    title: 'Luxury Champagne',
    subtitle: 'Premium Selection',
    description: 'Celebrate with premium champagnes',
    type: 'promotional',
    placement: 'home_secondary',
    priority: 'medium',
    ctaText: 'View Collection',
    ctaLink: '/shop?category=champagne',
    ctaStyle: 'primary',
    backgroundColor: '#1A1A2E',
    image: {
      url: 'https://images.unsplash.com/photo-1572575626618-6a0b5d6fb858?w=800',
      alt: 'Luxury Champagne'
    },
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['champagne', 'luxury', 'gift']
  },
  {
    _id: '4',
    title: 'Premium Wines Collection',
    subtitle: 'Hand-Selected',
    description: 'Hand-selected wines from renowned vineyards',
    type: 'promotional',
    placement: 'home_secondary',
    priority: 'low',
    ctaText: 'Discover',
    ctaLink: '/shop?category=wine',
    ctaStyle: 'primary',
    backgroundColor: '#2D1B0E',
    image: {
      url: 'https://images.unsplash.com/photo-1514218953589-2d7d37efd9dc?w=800',
      alt: 'Premium Wines Collection'
    },
    endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['wine', 'premium', 'limited']
  }
];

const CountdownTimer = ({ endDate }: { endDate?: string }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isUrgent, setIsUrgent] = useState(false);
  const [prevSeconds, setPrevSeconds] = useState(0);

  useEffect(() => {
    const targetDate = endDate ? new Date(endDate) : new Date(Date.now() + 48 * 60 * 60 * 1000);

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance < 0) return;

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setPrevSeconds(timeLeft.seconds);
      setTimeLeft({ days, hours, minutes, seconds });
      setIsUrgent(days < 1);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [endDate, timeLeft.seconds]);

  const timeUnits = [
    { value: timeLeft.days, prev: prevSeconds, label: 'Days', color: 'from-blue-500/80 to-blue-600/80' },
    { value: timeLeft.hours, prev: prevSeconds, label: 'Hours', color: isUrgent ? 'from-red-500/80 to-red-600/80' : 'from-purple-500/80 to-purple-600/80' },
    { value: timeLeft.minutes, prev: prevSeconds, label: 'Mins', color: 'from-amber-500/80 to-amber-600/80' },
    { value: timeLeft.seconds, prev: prevSeconds, label: 'Secs', color: isUrgent ? 'from-red-600/80 to-red-700/80' : 'from-emerald-500/80 to-emerald-600/80' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex items-center gap-2 mt-4"
    >
      {timeUnits.map((item, idx) => (
        <div key={item.label} className="flex flex-col items-center">
          <motion.div
            key={item.value}
            initial={item.value !== item.prev ? { scale: 1.2, y: -5 } : {}}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`bg-gradient-to-br ${item.color} backdrop-blur-md rounded-lg px-2 py-1.5 min-w-[32px] text-center shadow-lg border border-white/10`}
          >
            <span className="text-white font-black text-sm">{String(item.value).padStart(2, '0')}</span>
          </motion.div>
          <span className="text-white/50 text-[8px] mt-1 font-medium uppercase">{item.label}</span>
          {idx < 3 && <span className="text-white/30 text-lg font-bold -mt-4 ml-[38px]">:</span>}
        </div>
      ))}
    </motion.div>
  );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const badges: Record<string, { bg: string; icon: React.ReactNode; label: string; pulse: boolean }> = {
    urgent: { bg: 'bg-gradient-to-r from-red-500 to-red-600', icon: <Icon.PiFireFill size={10} />, label: 'Limited', pulse: true },
    high: { bg: 'bg-gradient-to-r from-orange-500 to-amber-500', icon: <Icon.PiTrendUp size={10} />, label: 'Hot', pulse: true },
    medium: { bg: 'bg-gradient-to-r from-blue-500 to-indigo-500', icon: <Icon.PiTagFill size={10} />, label: 'Offer', pulse: false },
    low: { bg: 'bg-gradient-to-r from-emerald-500 to-green-500', icon: <Icon.PiStarFill size={10} />, label: 'New', pulse: false }
  };

  const badge = badges[priority] || badges.medium;

  return (
    <motion.div
      initial={{ scale: 0, rotate: -15 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
      className={`absolute top-4 right-4 ${badge.bg} text-white px-3 py-1.5 rounded-full font-bold text-[9px] uppercase tracking-wider shadow-lg flex items-center gap-1.5 backdrop-blur-sm border border-white/20`}
    >
      <motion.span
        animate={badge.pulse ? { scale: [1, 1.3, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        {badge.icon}
      </motion.span>
      {badge.label}
    </motion.div>
  );
};

const DiscountBadge = ({ title }: { title: string }) => {
  const percentageMatch = title.match(/(\d+)%/);
  const isBogo = title.toLowerCase().includes('buy') && title.toLowerCase().includes('get');
  const isFree = title.toLowerCase().includes('free');

  if (percentageMatch) {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -15, y: -20 }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="absolute top-4 left-4 bg-gradient-to-br from-red-500 via-rose-500 to-pink-500 text-white px-4 py-2 rounded-xl font-black text-2xl shadow-2xl shadow-red-500/40 border border-white/30"
      >
        <motion.span
          animate={{ opacity: [1, 0.8, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          -{percentageMatch[1]}%
        </motion.span>
      </motion.div>
    );
  }

  if (isBogo) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="absolute top-4 left-4 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 text-white px-4 py-2 rounded-xl font-black text-xl shadow-2xl shadow-green-500/40 border border-white/30"
      >
        BOGO
      </motion.div>
    );
  }

  if (isFree) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="absolute top-4 left-4 bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-500 text-white px-4 py-2 rounded-xl font-black text-xl shadow-2xl shadow-purple-500/40 border border-white/30"
      >
        FREE
      </motion.div>
    );
  }

  return null;
};

const TagBadge = ({ tag, index }: { tag: string; index: number }) => (
  <motion.span
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ delay: 0.35 + index * 0.08, type: 'spring', stiffness: 200 }}
    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.25)' }}
    className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-white/80 text-[10px] font-medium border border-white/10 transition-colors"
  >
    #{tag}
  </motion.span>
);

const PromotionalBanner: React.FC<PromotionalBannerProps> = ({
  placement = 'home_secondary',
  layout = 'modern',
  showCountdown = true,
  columns = 2,
  variant = 'default'
}) => {
  const [banners, setBanners] = useState<BannerData[]>(defaultPromotionalBanners);
  const [loading, setLoading] = useState(false);
  const [hoveredBanner, setHoveredBanner] = useState<string | null>(null);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5001/api/banners/placement/${placement}?limit=${columns}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.length > 0) {
            setBanners(data.data);
          }
        }
      } catch {
        console.log('Using default promotional banners');
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [placement, columns]);

  const handleBannerClick = useCallback(async (bannerId: string) => {
    if (!bannerId) return;
    try {
      await fetch(`http://localhost:5001/api/banners/${bannerId}/click`, { method: 'POST' });
    } catch {
      // Ignore click tracking errors
    }
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {[...Array(columns)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative h-[200px] md:h-[280px] rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 overflow-hidden"
          >
            <motion.div
              animate={{ x: ['-100%', '100%'] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12"
            />
          </motion.div>
        ))}
      </div>
    );
  }

  if (banners.length === 0) return null;

  return (
    <section className="py-8 md:py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <AnimatePresence mode="popLayout">
          {banners.map((banner, index) => {
            const imageUrl = banner.mobileImage?.url || banner.image?.url || '/images/placeholder-product.png';
            const isHovered = hoveredBanner === (banner._id || `banner-${index}`);

            return (
              <motion.div
                key={banner._id || `banner-${index}`}
                layout
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ 
                  delay: index * 0.1, 
                  duration: 0.5,
                  layout: { duration: 0.3 }
                }}
                onMouseEnter={() => setHoveredBanner(banner._id || `banner-${index}`)}
                onMouseLeave={() => setHoveredBanner(null)}
                className="relative group"
              >
                <Link
                  href={banner.ctaLink || '#'}
                  onClick={() => handleBannerClick(banner._id)}
                  className="block relative overflow-hidden rounded-2xl h-[200px] md:h-[280px]"
                >
                  {/* Background Image with Parallax Zoom */}
                  <motion.div
                    className="absolute inset-0"
                    animate={{ 
                      scale: isHovered ? 1.1 : 1,
                      y: isHovered ? -5 : 0
                    }}
                    transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <Image
                      src={imageUrl}
                      alt={banner.image?.alt || banner.title || 'Banner'}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/images/placeholder-product.png';
                      }}
                    />
                  </motion.div>

                  {/* Animated Gradient Overlay */}
                  <motion.div
                    className="absolute inset-0"
                    animate={{
                      background: isHovered
                        ? `linear-gradient(to top, ${banner.backgroundColor || '#1A1A2E'}f0 0%, ${banner.backgroundColor || '#1A1A2E'}80 40%, transparent 100%)`
                        : `linear-gradient(to top, ${banner.backgroundColor || '#1A1A2E'}e0 0%, ${banner.backgroundColor || '#1A1A2E'}60 50%, transparent 100%)`
                    }}
                    transition={{ duration: 0.4 }}
                  />

                  {/* Discount Badge */}
                  <DiscountBadge title={banner.title} />

                  {/* Priority Badge */}
                  <PriorityBadge priority={banner.priority} />

                  {/* New Tag */}
                  {banner.tags?.includes('new') && (
                    <motion.div
                      initial={{ scale: 0, x: -30 }}
                      animate={{ scale: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
                      className="absolute top-4 right-4 bg-white text-gray-900 px-3 py-1.5 rounded-full font-bold text-[9px] uppercase tracking-wider shadow-xl"
                    >
                      NEW
                    </motion.div>
                  )}

                  {/* Content Area */}
                  <div className="relative z-10 h-full p-5 md:p-6 flex flex-col justify-end">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      {/* Subtitle */}
                      {banner.subtitle && (
                        <motion.span
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15, type: 'spring', stiffness: 100 }}
                          className="inline-flex items-center gap-1.5 text-white/70 text-[10px] font-semibold uppercase tracking-wider mb-2"
                        >
                          <span className="w-4 h-[1px] bg-white/50" />
                          {banner.subtitle}
                        </motion.span>
                      )}

                      {/* Title */}
                      <motion.h3
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-white text-lg md:text-xl font-bold mb-2 leading-tight drop-shadow-lg"
                      >
                        {banner.title}
                      </motion.h3>

                      {/* Description */}
                      {banner.description && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="text-white/60 text-xs mb-3 line-clamp-2 leading-relaxed"
                        >
                          {banner.description}
                        </motion.p>
                      )}

                      {/* Countdown Timer */}
                      {showCountdown && banner.priority === 'urgent' && (
                        <CountdownTimer endDate={banner.endDate} />
                      )}

                      {/* CTA Button */}
                      {banner.ctaText && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.25 }}
                          className="mt-4"
                        >
                          <motion.span
                            whileHover={{ scale: 1.03, x: 3 }}
                            whileTap={{ scale: 0.98 }}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-xs transition-all duration-300 shadow-lg ${
                              banner.ctaStyle === 'primary'
                                ? 'bg-white text-gray-900 hover:bg-gray-100 hover:shadow-xl'
                                : banner.ctaStyle === 'secondary'
                                ? 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-xl'
                                : 'border-2 border-white/80 text-white hover:bg-white hover:text-gray-900 hover:border-white backdrop-blur-sm'
                            }`}
                          >
                            {banner.ctaText}
                            <motion.span
                              animate={{ x: isHovered ? 4 : 0 }}
                              transition={{ type: 'spring', stiffness: 300 }}
                            >
                              <Icon.PiArrowRight size={14} />
                            </motion.span>
                          </motion.span>
                        </motion.div>
                      )}

                      {/* Tags */}
                      {layout === 'modern' && banner.tags && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="flex flex-wrap gap-1.5 mt-4"
                        >
                          {banner.tags.slice(0, 3).map((tag, i) => (
                            <TagBadge key={tag} tag={tag} index={i} />
                          ))}
                        </motion.div>
                      )}
                    </motion.div>
                  </div>

                  {/* Hover Glow Effect */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent pointer-events-none"
                  />

                  {/* Shimmer Effect on Hover */}
                  <motion.div
                    initial={{ x: '-100%', opacity: 0 }}
                    animate={{ 
                      x: isHovered ? '100%' : '-100%',
                      opacity: isHovered ? 0.3 : 0
                    }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
                  />
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default PromotionalBanner;
