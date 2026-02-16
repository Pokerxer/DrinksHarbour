'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface AnnouncementBannerProps {
  placement?: string;
  layout?: 'marquee' | 'static' | 'alert' | 'toast';
  limit?: number;
  showClose?: boolean;
  scrollSpeed?: number;
  pauseOnHover?: boolean;
  variant?: 'info' | 'success' | 'warning' | 'error' | 'promo';
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
  backgroundColor?: string;
  textColor?: string;
  icon?: string;
  tags?: string[];
  startDate?: string;
  endDate?: string;
}

const defaultAnnouncements: BannerData[] = [
  {
    _id: 'default-1',
    title: 'Free Delivery on Orders Over ₦50,000',
    subtitle: 'Fast & Reliable Shipping',
    type: 'announcement',
    placement: 'header',
    ctaText: 'Learn More',
    ctaLink: '/shipping-info',
    backgroundColor: '#4CAF50',
    textColor: '#FFFFFF',
    tags: ['delivery', 'free-delivery']
  },
  {
    _id: 'default-2',
    title: 'Get 10% Off Your First Order',
    subtitle: 'Use Code: WELCOME10',
    type: 'announcement',
    placement: 'header',
    backgroundColor: '#2196F3',
    textColor: '#FFFFFF',
    tags: ['promo', 'discount']
  },
  {
    _id: 'default-3',
    title: 'Age Verification Required',
    subtitle: 'You must be 18+ to purchase',
    type: 'announcement',
    placement: 'header',
    ctaText: 'Verify Age',
    backgroundColor: '#FF9800',
    textColor: '#FFFFFF',
    tags: ['compliance', 'legal']
  }
];

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  placement = 'header',
  layout = 'marquee',
  limit = 5,
  showClose = false,
  scrollSpeed = 30,
  pauseOnHover = true,
  variant = 'promo'
}) => {
  const [banners, setBanners] = useState<BannerData[]>(defaultAnnouncements);
  const [loading, setLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5001/api/banners/placement/${placement}?limit=${limit}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.length > 0) {
            setBanners(data.data);
          }
        }
      } catch (err) {
        // Use default announcements on error
        console.log('Using default announcements');
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [placement, limit]);

  const getVariantStyles = (bannerVariant: string | undefined, bgColor: string | undefined) => {
    if (bgColor) {
      return {
        backgroundColor: bgColor,
        textColor: '#FFFFFF'
      };
    }

    const variants: Record<string, { bg: string; text: string; iconBg: string }> = {
      info: { bg: '#2196F3', text: '#FFFFFF', iconBg: 'rgba(255,255,255,0.2)' },
      success: { bg: '#4CAF50', text: '#FFFFFF', iconBg: 'rgba(255,255,255,0.2)' },
      warning: { bg: '#FF9800', text: '#FFFFFF', iconBg: 'rgba(255,255,255,0.2)' },
      error: { bg: '#F44336', text: '#FFFFFF', iconBg: 'rgba(255,255,255,0.2)' },
      promo: { bg: '#9C27B0', text: '#FFFFFF', iconBg: 'rgba(255,255,255,0.2)' }
    };

    return variants[bannerVariant || 'promo'] || variants.promo;
  };

  const getVariantIcon = (bannerVariant: string | undefined) => {
    const icons: Record<string, JSX.Element> = {
      info: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
      success: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      warning: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
      error: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      promo: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
        </svg>
      )
    };

    return icons[bannerVariant || 'promo'] || icons.promo;
  };

  const handleClose = (bannerId: string) => {
    setDismissedIds(prev => new Set(prev).add(bannerId));
  };

  const handleReset = () => {
    setDismissedIds(new Set());
  };

  const handleBannerClick = async (bannerId: string) => {
    if (!bannerId) return;
    try {
      await fetch(`http://localhost:5001/api/banners/${bannerId}/click`, {
        method: 'POST'
      });
    } catch (err) {
      // Ignore click tracking errors
    }
  };

  const activeBanners = banners.filter(b => !dismissedIds.has(b._id));

  if (loading) {
    return (
      <div className="h-10 bg-gray-200 animate-pulse"></div>
    );
  }

  if (activeBanners.length === 0) {
    return null;
  }

  // Toast Layout
  if (layout === 'toast') {
    return (
      <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
        <AnimatePresence>
          {activeBanners.slice(0, 3).map((banner) => {
            const styles = getVariantStyles(variant, banner.backgroundColor);
            return (
              <motion.div
                key={banner._id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="rounded-lg shadow-lg overflow-hidden"
                style={{ backgroundColor: styles.backgroundColor }}
              >
                <div className="p-4 flex items-start gap-3">
                  <div 
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: styles.iconBg, color: styles.textColor }}
                  >
                    {getVariantIcon(variant)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: styles.textColor }}>
                      {banner.title}
                    </p>
                    {banner.subtitle && (
                      <p className="text-xs mt-1 opacity-90" style={{ color: styles.textColor }}>
                        {banner.subtitle}
                      </p>
                    )}
                    {banner.ctaText && (
                      <Link
                        href={banner.ctaLink || '#'}
                        onClick={() => handleBannerClick(banner._id)}
                        className="inline-block mt-2 text-xs font-semibold underline hover:no-underline"
                        style={{ color: styles.textColor }}
                      >
                        {banner.ctaText}
                      </Link>
                    )}
                  </div>
                  {showClose && (
                    <button
                      onClick={() => handleClose(banner._id)}
                      className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                      style={{ color: styles.textColor }}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }

  // Alert Layout
  if (layout === 'alert') {
    return (
      <div className="space-y-3">
        {activeBanners.map((banner) => {
          const styles = getVariantStyles(variant, banner.backgroundColor);
          return (
            <motion.div
              key={banner._id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-lg p-4"
              style={{ backgroundColor: styles.backgroundColor }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: styles.iconBg, color: styles.textColor }}
                >
                  {getVariantIcon(variant)}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold" style={{ color: styles.textColor }}>
                    {banner.title}
                  </h4>
                  {banner.subtitle && (
                    <p className="text-xs mt-1 opacity-90" style={{ color: styles.textColor }}>
                      {banner.subtitle}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {banner.ctaText && (
                    <Link
                      href={banner.ctaLink || '#'}
                      onClick={() => handleBannerClick(banner._id)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:brightness-110"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: styles.textColor }}
                    >
                      {banner.ctaText}
                    </Link>
                  )}
                  {showClose && (
                    <button
                      onClick={() => handleClose(banner._id)}
                      className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                      style={{ color: styles.textColor }}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }

  // Static Layout
  if (layout === 'static') {
    const banner = activeBanners[0];
    if (!banner) return null;

    const styles = getVariantStyles(variant, banner.backgroundColor);
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
        style={{ backgroundColor: styles.backgroundColor }}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <div 
              className="flex items-center gap-2"
              style={{ color: styles.textColor }}
            >
              {getVariantIcon(variant)}
              <span className="text-sm font-medium">{banner.title}</span>
            </div>
            {banner.subtitle && (
              <span className="text-sm opacity-90" style={{ color: styles.textColor }}>
                {banner.subtitle}
              </span>
            )}
            {banner.ctaText && (
              <Link
                href={banner.ctaLink || '#'}
                onClick={() => handleBannerClick(banner._id)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors hover:brightness-110"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: styles.textColor }}
              >
                {banner.ctaText}
              </Link>
            )}
          </div>
        </div>
        {showClose && (
          <button
            onClick={() => handleClose(banner._id)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: styles.textColor }}
          >
            ✕
          </button>
        )}
      </motion.div>
    );
  }

  // Marquee Layout (Default)
  return (
    <div className="relative" style={{ backgroundColor: getVariantStyles(variant, undefined).bg }}>
      <div className="overflow-hidden py-3">
        <div className="flex animate-marquee whitespace-nowrap">
          {activeBanners.map((banner, index) => (
            <React.Fragment key={banner._id}>
              <div className="flex items-center gap-6 px-8" style={{ color: getVariantStyles(variant, banner.backgroundColor).textColor }}>
                <div className="flex items-center gap-2">
                  {getVariantIcon(variant)}
                  <span className="text-sm font-medium">{banner.title}</span>
                </div>
                {banner.subtitle && (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="text-sm opacity-90">{banner.subtitle}</span>
                  </>
                )}
                {banner.ctaText && (
                  <>
                    <span className="opacity-50">•</span>
                    <Link
                      href={banner.ctaLink || '#'}
                      onClick={() => handleBannerClick(banner._id)}
                      className="text-sm font-semibold hover:underline"
                    >
                      {banner.ctaText}
                    </Link>
                  </>
                )}
              </div>
              {index < activeBanners.length - 1 && (
                <span className="opacity-30">|</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      {/* Reset Button */}
      {dismissedIds.size > 0 && (
        <button
          onClick={handleReset}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: getVariantStyles(variant, undefined).textColor }}
        >
          Reset
        </button>
      )}
    </div>
  );
};

export default AnnouncementBanner;
