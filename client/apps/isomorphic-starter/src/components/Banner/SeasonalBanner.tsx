'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface SeasonalBannerProps {
  placement?: string;
  theme?: 'christmas' | 'newyear' | 'easter' | 'summer' | 'halloween' | 'valentine' | 'blackfriday' | 'custom';
  layout?: 'hero' | 'card' | 'minimal' | 'split';
  limit?: number;
  showDecorations?: boolean;
  showCountdown?: boolean;
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
  theme?: string;
}

const SeasonalBanner: React.FC<SeasonalBannerProps> = ({
  placement = 'home_secondary',
  theme = 'christmas',
  layout = 'hero',
  limit = 3,
  showDecorations = true,
  showCountdown = true
}) => {
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});

  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5001/api/banners/placement/${placement}?type=seasonal&limit=${limit}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBanners(data.data || []);
        } else {
          setError('Failed to fetch seasonal banners');
        }
      } else {
        setError('Failed to fetch seasonal banners');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error('Error fetching banners:', err);
    } finally {
      setLoading(false);
    }
  }, [placement, limit]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  useEffect(() => {
    if (!showCountdown) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const timeLeftMap: Record<string, string> = {};

      banners.forEach((banner) => {
        if (banner.endDate) {
          const endDate = new Date(banner.endDate);
          const diff = endDate.getTime() - now.getTime();

          if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (days > 0) {
              timeLeftMap[banner._id] = `${days}d ${hours}h`;
            } else if (hours > 0) {
              timeLeftMap[banner._id] = `${hours}h ${minutes}m`;
            } else {
              timeLeftMap[banner._id] = `${minutes}m`;
            }
          } else {
            timeLeftMap[banner._id] = 'Ended';
          }
        }
      });

      setTimeLeft(timeLeftMap);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(timer);
  }, [banners, showCountdown]);

  const getThemeConfig = (themeName: string) => {
    const themes: Record<string, {
      colors: { primary: string; secondary: string; accent: string; gradient: string };
      decorations: string[];
      icons: string[];
    }> = {
      christmas: {
        colors: {
          primary: '#C41E3A',
          secondary: '#228B22',
          accent: '#FFD700',
          gradient: 'from-red-600 via-green-500 to-red-600'
        },
        decorations: ['🎄', '🎅', '🎁', '❄️', '🔔', '⭐', '🦌', '☃️'],
        icons: ['❄️', '🎄', '🎅']
      },
      newyear: {
        colors: {
          primary: '#1A1A2E',
          secondary: '#FFD700',
          accent: '#C0C0C0',
          gradient: 'from-gray-900 via-purple-600 to-gray-900'
        },
        decorations: ['🎉', '✨', '🎊', '🥂', '🎆', '💫', '🕛', '👑'],
        icons: ['✨', '🎊', '🕛']
      },
      easter: {
        colors: {
          primary: '#FFB6C1',
          secondary: '#98FB98',
          accent: '#87CEEB',
          gradient: 'from-pink-300 via-green-200 to-blue-300'
        },
        decorations: ['🐰', '🥚', '🌸', '🌷', '🦋', '🐤', '🌼', '🎀'],
        icons: ['🐰', '🥚', '🌸']
      },
      summer: {
        colors: {
          primary: '#FF6B6B',
          secondary: '#4ECDC4',
          accent: '#FFE66D',
          gradient: 'from-orange-400 via-yellow-400 to-cyan-400'
        },
        decorations: ['☀️', '🏖️', '🍦', '🌴', '🏊', '🍹', '🕶️', '🌊'],
        icons: ['☀️', '🏖️', '🍹']
      },
      halloween: {
        colors: {
          primary: '#FF6600',
          secondary: '#4A0080',
          accent: '#00FF00',
          gradient: 'from-orange-600 via-purple-600 to-green-600'
        },
        decorations: ['🎃', '👻', '🦇', '💀', '🕷️', '🕸️', '🍬', '⚰️'],
        icons: ['🎃', '👻', '🦇']
      },
      valentine: {
        colors: {
          primary: '#FF1493',
          secondary: '#FF69B4',
          accent: '#FFD700',
          gradient: 'from-pink-400 via-red-400 to-pink-600'
        },
        decorations: ['❤️', '💕', '💌', '🌹', '🥰', '💎', '🍫', '🎀'],
        icons: ['❤️', '💕', '🌹']
      },
      blackfriday: {
        colors: {
          primary: '#000000',
          secondary: '#FF0000',
          accent: '#FFFFFF',
          gradient: 'from-black via-gray-900 to-black'
        },
        decorations: ['🛒', '💥', '🔥', '⚡', '🏷️', '💰', '📦', '⬇️'],
        icons: ['💥', '🔥', '⚡']
      },
      custom: {
        colors: {
          primary: '#6366F1',
          secondary: '#8B5CF6',
          accent: '#F59E0B',
          gradient: 'from-indigo-500 via-purple-500 to-pink-500'
        },
        decorations: ['⭐', '✨', '🎯', '💫', '🎨', '🌟'],
        icons: ['✨', '⭐', '🎯']
      }
    };

    return themes[themeName] || themes.custom;
  };

  const themeConfig = getThemeConfig(theme);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const currentBanner = banners[activeIndex];
  const imageUrl = currentBanner
    ? (isMobile && currentBanner.mobileImage?.url ? currentBanner.mobileImage.url : currentBanner.image.url)
    : null;

  const handleBannerClick = async (bannerId: string) => {
    if (!bannerId) return;
    try {
      await fetch(`http://localhost:5001/api/banners/${bannerId}/click`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Error tracking click:', err);
    }
  };

  const getContentPosition = (position: string = 'center') => {
    const positions: Record<string, string> = {
      'top-left': 'items-start justify-start',
      'top-center': 'items-start justify-center',
      'top-right': 'items-start justify-end',
      'center-left': 'items-center justify-start',
      'center': 'items-center justify-center',
      'center-right': 'items-center justify-end',
      'bottom-left': 'items-end justify-start',
      'bottom-center': 'items-end justify-center',
      'bottom-right': 'items-end justify-end'
    };
    return positions[position] || 'items-center justify-center';
  };

  const getTextAlignment = (alignment: string = 'center') => {
    const alignments: Record<string, string> = {
      'left': 'text-left',
      'center': 'text-center',
      'right': 'text-right'
    };
    return alignments[alignment] || 'text-center';
  };

  // Loading State
  if (loading) {
    return (
      <div className={`relative overflow-hidden rounded-2xl h-[300px] md:h-[400px] bg-gradient-to-r ${themeConfig.colors.gradient} animate-pulse`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  // Hero Layout
  if (layout === 'hero') {
    return (
      <section className="seasonal-banner-hero py-8">
        {/* Decorations */}
        {showDecorations && (
          <div className="relative mb-4">
            {themeConfig.decorations.slice(0, 8).map((decoration, i) => (
              <motion.span
                key={i}
                className="absolute text-2xl"
                style={{
                  left: `${10 + i * 10}%`,
                  top: i % 2 === 0 ? '0' : '10px',
                  animationDelay: `${i * 0.2}s`
                }}
                animate={{
                  y: [0, -10, 0],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3
                }}
              >
                {decoration}
              </motion.span>
            ))}
          </div>
        )}

        <div 
          className="relative rounded-2xl overflow-hidden h-[300px] md:h-[450px] lg:h-[500px]"
          style={{
            background: imageUrl
              ? undefined
              : `linear-gradient(135deg, ${themeConfig.colors.primary}40 0%, ${themeConfig.colors.secondary}40 100%)`
          }}
        >
          {/* Background */}
          {imageUrl && (
            <>
              <Image
                src={imageUrl}
                alt={currentBanner?.title || 'Seasonal Banner'}
                fill
                className="object-cover"
                priority
              />
              <div 
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to right, ${currentBanner?.backgroundColor || themeConfig.colors.primary}dd, transparent 60%)`
                }}
              ></div>
            </>
          )}

          {/* Decorative Overlay */}
          {showDecorations && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-white/20"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    fontSize: `${Math.random() * 20 + 10}px`
                  }}
                  animate={{
                    y: [0, -100],
                    opacity: [0, 1, 0]
                  }}
                  transition={{
                    duration: Math.random() * 3 + 2,
                    repeat: Infinity,
                    delay: Math.random() * 2
                  }}
                >
                  {themeConfig.decorations[i % themeConfig.decorations.length]}
                </motion.div>
              ))}
            </div>
          )}

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentBanner?._id || 'default'}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className={`relative z-10 h-full container mx-auto px-6 md:px-10 flex ${getContentPosition(currentBanner?.contentPosition)}`}
            >
              <div className={`max-w-2xl ${getTextAlignment(currentBanner?.textAlignment)}`}>
                {/* Theme Icon */}
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center gap-2 mb-4"
                >
                  {themeConfig.icons.map((icon, i) => (
                    <motion.span
                      key={i}
                      className="text-3xl md:text-4xl"
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                    >
                      {icon}
                    </motion.span>
                  ))}
                </motion.div>

                {/* Subtitle */}
                {currentBanner?.subtitle && (
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-white/90 text-sm md:text-base font-medium uppercase tracking-wider mb-3"
                  >
                    {currentBanner.subtitle}
                  </motion.p>
                )}

                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-white text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
                >
                  {currentBanner?.title || 'Special Season Sale'}
                </motion.h2>

                {/* Description */}
                {currentBanner?.description && (
                  <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-white/80 text-lg mb-6 max-w-lg"
                  >
                    {currentBanner.description}
                  </motion.p>
                )}

                {/* CTA & Countdown */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-wrap items-center gap-4 justify-center lg:justify-start"
                >
                  {/* Countdown */}
                  {showCountdown && currentBanner && timeLeft[currentBanner._id] && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm">
                      <span className="text-white/70 text-sm">Ends in:</span>
                      <span className="text-white font-bold">{timeLeft[currentBanner._id]}</span>
                    </div>
                  )}

                  {/* CTA Button */}
                  {currentBanner?.ctaText && (
                    <Link
                      href={currentBanner.ctaLink || '#'}
                      onClick={() => handleBannerClick(currentBanner._id)}
                      className={`inline-flex items-center gap-2 px-8 py-3 rounded-full font-bold transition-all duration-300 transform hover:scale-105 ${
                        currentBanner.ctaStyle === 'primary'
                          ? 'bg-white text-gray-900 hover:bg-gray-100'
                          : `bg-${themeConfig.colors.accent} text-gray-900`
                      }`}
                      style={{
                        backgroundColor: currentBanner?.ctaStyle === 'primary' ? '#FFFFFF' : undefined,
                        color: currentBanner?.ctaStyle === 'primary' ? '#1A1A2E' : undefined
                      }}
                    >
                      {currentBanner.ctaText}
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Dots */}
          {banners.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? 'bg-white w-8'
                      : 'bg-white/50 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Card Layout
  if (layout === 'card') {
    return (
      <section className="seasonal-banner-card py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.map((banner, index) => (
            <motion.div
              key={banner._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative rounded-2xl overflow-hidden h-[280px] md:h-[320px] group"
            >
              {/* Background */}
              <Image
                src={banner.image.url}
                alt={banner.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div 
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to top, ${banner.backgroundColor || themeConfig.colors.primary}ee, transparent 70%)`
                }}
              ></div>

              {/* Decorative Corner */}
              {showDecorations && (
                <div className="absolute top-4 right-4 text-2xl">
                  {themeConfig.decorations[index % themeConfig.decorations.length]}
                </div>
              )}

              {/* Content */}
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <motion.h3
                  className="text-white text-xl md:text-2xl font-bold mb-2"
                >
                  {banner.title}
                </motion.h3>

                {banner.subtitle && (
                  <p className="text-white/80 text-sm mb-3">{banner.subtitle}</p>
                )}

                {showCountdown && timeLeft[banner._id] && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm mb-3 w-fit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {timeLeft[banner._id]}
                  </div>
                )}

                {banner.ctaText && (
                  <Link
                    href={banner.ctaLink || '#'}
                    onClick={() => handleBannerClick(banner._id)}
                    className="inline-flex items-center gap-2 text-white font-semibold hover:gap-3 transition-all"
                  >
                    {banner.ctaText}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  // Minimal Layout
  if (layout === 'minimal') {
    return (
      <section className="seasonal-banner-minimal py-4">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {banners.map((banner) => (
            <motion.div
              key={banner._id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 px-4 py-2 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${banner.backgroundColor || themeConfig.colors.primary} 0%, ${banner.backgroundColor || themeConfig.colors.primary}dd 100%)`
              }}
            >
              <span className="text-lg">{themeConfig.decorations[0]}</span>
              <Link
                href={banner.ctaLink || '#'}
                onClick={() => handleBannerClick(banner._id)}
                className="text-white font-medium text-sm"
              >
                {banner.title}
              </Link>
              {showCountdown && timeLeft[banner._id] && (
                <span className="text-white/70 text-xs">• {timeLeft[banner._id]}</span>
              )}
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  // Split Layout
  if (layout === 'split') {
    const banner = banners[0];
    if (!banner) return null;

    return (
      <section className="seasonal-banner-split py-6">
        <div className="relative rounded-2xl overflow-hidden h-[250px] md:h-[300px]">
          <div className="absolute inset-0 flex">
            {/* Content Side */}
            <div 
              className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center"
              style={{
                background: `linear-gradient(135deg, ${banner.backgroundColor || themeConfig.colors.primary} 0%, ${banner.backgroundColor || themeConfig.colors.primary}dd 100%)`
              }}
            >
              <div className="flex gap-2 mb-4">
                {themeConfig.icons.map((icon, i) => (
                  <span key={i} className="text-2xl">{icon}</span>
                ))}
              </div>

              <h3 className="text-white text-2xl md:text-3xl font-bold mb-2">
                {banner.title}
              </h3>

              {banner.subtitle && (
                <p className="text-white/80 text-sm mb-4">{banner.subtitle}</p>
              )}

              {banner.ctaText && (
                <Link
                  href={banner.ctaLink || '#'}
                  onClick={() => handleBannerClick(banner._id)}
                  className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors w-fit"
                >
                  {banner.ctaText}
                </Link>
              )}
            </div>

            {/* Image Side */}
            <div className="hidden md:block md:w-1/2 relative">
              <Image
                src={banner.image.url}
                alt={banner.title}
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Floating Decorations */}
          {showDecorations && (
            <>
              <motion.div
                className="absolute top-4 left-1/2 -translate-x-1/2 text-4xl"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {themeConfig.decorations[0]}
              </motion.div>
            </>
          )}
        </div>
      </section>
    );
  }

  return null;
};

export default SeasonalBanner;
