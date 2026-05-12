'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const DISMISS_KEY = 'dh_announcement_dismissed';

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
  backgroundColor?: string;
  textColor?: string;
  tags?: string[];
  startDate?: string;
  endDate?: string;
}

const DEFAULT_ANNOUNCEMENTS: BannerData[] = [
  {
    _id: 'def-1', title: 'Free Delivery on Orders Over ₦2,000,000', subtitle: 'Fast & Reliable Shipping',
    type: 'announcement', placement: 'header', ctaText: 'Shop Now', ctaLink: '/shop',
    backgroundColor: '#7C1D1D', textColor: '#FFFFFF',
  },
  {
    _id: 'def-2', title: 'Get 10% Off Your First Order', subtitle: 'Use Code: WELCOME10',
    type: 'announcement', placement: 'header',
    backgroundColor: '#1A1A2E', textColor: '#FFFFFF',
  },
  {
    _id: 'def-3', title: 'Premium Spirits, Authentic Products', subtitle: 'Curated Selection',
    type: 'announcement', placement: 'header', ctaText: 'Explore', ctaLink: '/shop',
    backgroundColor: '#7C1D1D', textColor: '#FFFFFF',
  },
];

const VARIANT_STYLES: Record<string, { bg: string; text: string }> = {
  info:    { bg: '#1E40AF', text: '#FFFFFF' },
  success: { bg: '#15803D', text: '#FFFFFF' },
  warning: { bg: '#B45309', text: '#FFFFFF' },
  error:   { bg: '#B91C1C', text: '#FFFFFF' },
  promo:   { bg: '#7C1D1D', text: '#FFFFFF' },
};

function VariantIcon({ v }: { v: string }) {
  const size = 14;
  if (v === 'info')    return <Icon.PiInfoBold size={size} />;
  if (v === 'success') return <Icon.PiCheckCircleBold size={size} />;
  if (v === 'warning') return <Icon.PiWarningBold size={size} />;
  if (v === 'error')   return <Icon.PiXCircleBold size={size} />;
  return <Icon.PiLightningBold size={size} />;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  placement = 'header',
  layout = 'marquee',
  limit = 5,
  showClose = true,
  scrollSpeed = 40,
  pauseOnHover = true,
  variant = 'promo',
}) => {
  const [banners, setBanners] = useState<BannerData[]>(DEFAULT_ANNOUNCEMENTS);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Restore dismissed IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      if (stored) setDismissed(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/banners/placement/${placement}?limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.length > 0) setBanners(data.data);
        }
      } catch {}
      finally { setLoading(false); }
    };
    fetchBanners();
  }, [placement, limit]);

  const dismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev).add(id);
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const trackClick = async (id: string) => {
    if (!id || id.startsWith('def')) return;
    try { await fetch(`${API_URL}/api/banners/${id}/click`, { method: 'POST' }); } catch {}
  };

  const active = banners.filter(b => !dismissed.has(b._id));

  const getBg = (b: BannerData) => b.backgroundColor || VARIANT_STYLES[variant]?.bg || '#7C1D1D';

  if (loading) return <div className="h-10 bg-[#7C1D1D] animate-pulse" />;
  if (active.length === 0) return null;

  // ── Toast ──────────────────────────────────────────────────────────────────
  if (layout === 'toast') {
    return (
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {active.slice(0, 3).map(b => (
            <motion.div
              key={b._id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              className="pointer-events-auto rounded-xl shadow-xl overflow-hidden"
              style={{ backgroundColor: getBg(b) }}
            >
              <div className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 text-white">
                  <VariantIcon v={variant} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-snug">{b.title}</p>
                  {b.subtitle && <p className="text-xs text-white/75 mt-0.5">{b.subtitle}</p>}
                  {b.ctaText && (
                    <Link href={b.ctaLink || '#'} onClick={() => trackClick(b._id)}
                      className="inline-block mt-2 text-xs font-bold text-white underline hover:no-underline">
                      {b.ctaText}
                    </Link>
                  )}
                </div>
                {showClose && (
                  <button onClick={() => dismiss(b._id)} className="text-white/60 hover:text-white flex-shrink-0">
                    <Icon.PiXBold size={13} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  // ── Alert ──────────────────────────────────────────────────────────────────
  if (layout === 'alert') {
    return (
      <div className="space-y-2">
        {active.map(b => (
          <motion.div
            key={b._id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-xl p-4"
            style={{ backgroundColor: getBg(b) }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 text-white">
                <VariantIcon v={variant} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{b.title}</p>
                {b.subtitle && <p className="text-xs text-white/75 mt-0.5">{b.subtitle}</p>}
              </div>
              <div className="flex items-center gap-2">
                {b.ctaText && (
                  <Link href={b.ctaLink || '#'} onClick={() => trackClick(b._id)}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 text-white transition-colors">
                    {b.ctaText}
                  </Link>
                )}
                {showClose && (
                  <button onClick={() => dismiss(b._id)} className="p-1 text-white/60 hover:text-white transition-colors">
                    <Icon.PiXBold size={14} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // ── Static ─────────────────────────────────────────────────────────────────
  if (layout === 'static') {
    const b = active[0];
    if (!b) return null;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
        style={{ backgroundColor: getBg(b) }}
      >
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="text-white/80"><VariantIcon v={variant} /></span>
            <span className="text-sm font-semibold text-white">{b.title}</span>
            {b.subtitle && <span className="text-xs text-white/75 hidden sm:inline">— {b.subtitle}</span>}
            {b.ctaText && (
              <Link href={b.ctaLink || '#'} onClick={() => trackClick(b._id)}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-bold text-white transition-colors">
                {b.ctaText}
              </Link>
            )}
          </div>
        </div>
        {showClose && (
          <button
            onClick={() => dismiss(b._id)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <Icon.PiXBold size={14} />
          </button>
        )}
      </motion.div>
    );
  }

  // ── Marquee (default) ──────────────────────────────────────────────────────
  // Duplicate items so the scroll appears seamless
  const bg = getBg(active[0]);
  const marqueeItems = [...active, ...active];   // duplicate for loop

  return (
    <div
      className="relative overflow-hidden"
      style={{ backgroundColor: bg }}
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => pauseOnHover && setPaused(false)}
    >
      <div className="py-2.5">
        <motion.div
          ref={trackRef}
          animate={{ x: paused ? undefined : ['0%', '-50%'] }}
          transition={{ repeat: Infinity, duration: active.length * scrollSpeed, ease: 'linear' }}
          className="flex whitespace-nowrap"
        >
          {marqueeItems.map((b, idx) => (
            <span key={`${b._id}-${idx}`} className="inline-flex items-center gap-4 px-6">
              <span className="text-white/70 flex-shrink-0"><VariantIcon v={variant} /></span>
              <span className="text-sm font-semibold text-white">{b.title}</span>
              {b.subtitle && (
                <>
                  <span className="text-white/30">•</span>
                  <span className="text-sm text-white/75">{b.subtitle}</span>
                </>
              )}
              {b.ctaText && (
                <>
                  <span className="text-white/30">•</span>
                  <Link
                    href={b.ctaLink || '#'}
                    onClick={() => trackClick(b._id)}
                    className="text-sm font-bold text-white hover:underline"
                  >
                    {b.ctaText} →
                  </Link>
                </>
              )}
              <span className="text-white/20 ml-4">◆</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10"
        style={{ background: `linear-gradient(to right, ${bg}, transparent)` }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10"
        style={{ background: `linear-gradient(to left, ${bg}, transparent)` }} />
    </div>
  );
};

export default AnnouncementBanner;
