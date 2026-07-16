'use client';

// Lightweight placement-aware banner that fetches from the public banners
// API for a given placement (product_page, checkout, footer) and renders a
// polished, content-positioned banner with CTA styling + impression/click
// tracking. Returns null when no banners are found so the page layout is
// unaffected.

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface BannerData {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type?: string;
  placement?: string;
  ctaText?: string;
  ctaLink?: string;
  ctaStyle?: string;
  backgroundColor?: string;
  textColor?: string;
  overlayOpacity?: number;
  textAlignment?: string;
  contentPosition?: string;
  image?: { url?: string; alt?: string };
  mobileImage?: { url?: string };
  priority?: string;
}

const POSITION_CLS: Record<string, string> = {
  'top-left':       'items-start justify-start text-left',
  'top-center':     'items-start justify-center text-center',
  'top-right':      'items-start justify-end text-right',
  'center-left':    'items-center justify-start text-left',
  'center':         'items-center justify-center text-center',
  'center-right':   'items-center justify-end text-right',
  'bottom-left':    'items-end justify-start text-left',
  'bottom-center':  'items-end justify-center text-center',
  'bottom-right':   'items-end justify-end text-right',
};

const CTA_CLS: Record<string, string> = {
  primary:   'bg-orange-500 text-white hover:bg-orange-600',
  secondary: 'bg-white text-gray-900 hover:bg-gray-100 border border-white/30',
  outline:   'bg-transparent text-white border-2 border-white hover:bg-white/10',
  text:      'text-white underline underline-offset-4 hover:decoration-2',
  custom:    'bg-gray-900 text-white hover:bg-gray-800',
};

type Variant = 'hero' | 'compact' | 'footer' | 'sidebar';

export default function PlacementBanner({
  placement,
  variant = 'hero',
  limit = 1,
  className = '',
}: {
  placement: string;
  variant?: Variant;
  limit?: number;
  className?: string;
}) {
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [loading, setLoading] = useState(true);
  const trackedRef = useRef<Set<string>>(new Set());

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/banners/placement/${placement}?limit=${limit}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const data = await res.json();
      const list: BannerData[] = data?.data || data?.banners || [];
      if (Array.isArray(list) && list.length) setBanners(list);
    } catch {
      /* silent — no banner is a valid state */
    } finally {
      setLoading(false);
    }
  }, [placement, limit]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  // Fire a single impression per banner
  useEffect(() => {
    if (!banners.length) return;
    banners.forEach((b) => {
      if (trackedRef.current.has(b._id)) return;
      trackedRef.current.add(b._id);
      fetch(`${API_URL}/api/banners/${b._id}/impression`, { method: 'POST' }).catch(() => {});
    });
  }, [banners]);

  const trackClick = (id: string) => {
    fetch(`${API_URL}/api/banners/${id}/click`, { method: 'POST' }).catch(() => {});
  };

  if (loading || !banners.length) return null;

  const banner = banners[0];
  const posCls = POSITION_CLS[banner.contentPosition || 'center'] || POSITION_CLS.center;
  const ctaCls = CTA_CLS[banner.ctaStyle || 'primary'] || CTA_CLS.primary;
  const overlay = (banner.overlayOpacity ?? 0) / 100;

  // ─── Footer variant — compact promo strip ────────────────────────────────────
  if (variant === 'footer') {
    return (
      <div className={className}>
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ backgroundColor: banner.backgroundColor || '#7C1D1D' }}
        >
          {banner.image?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner.image.url}
              alt={banner.image?.alt || banner.title}
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
          )}
          <div className="relative flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h3 className="text-lg font-black text-white drop-shadow" style={{ color: banner.textColor || '#fff' }}>
                {banner.title}
              </h3>
              {banner.subtitle && (
                <p className="mt-0.5 text-sm text-white/70" style={{ color: banner.textColor ? `${banner.textColor}b0` : undefined }}>
                  {banner.subtitle}
                </p>
              )}
            </div>
            {banner.ctaText && (
              <Link
                href={banner.ctaLink || '#'}
                onClick={() => trackClick(banner._id)}
                className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold transition ${ctaCls}`}
              >
                {banner.ctaText}
                <Icon.PiArrowRightBold className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Compact variant — checkout / inline strip ───────────────────────────────
  if (variant === 'compact') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={className}
        >
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: banner.backgroundColor || '#1A1A2E' }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {banner.image?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.image.url}
                  alt={banner.image?.alt || banner.title}
                  className="hidden h-12 w-20 flex-shrink-0 rounded-lg object-cover sm:block"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold" style={{ color: banner.textColor || '#fff' }}>
                  {banner.title}
                </p>
                {banner.subtitle && (
                  <p className="truncate text-xs" style={{ color: banner.textColor ? `${banner.textColor}b0` : 'rgba(255,255,255,0.7)' }}>
                    {banner.subtitle}
                  </p>
                )}
              </div>
            </div>
            {banner.ctaText && (
              <Link
                href={banner.ctaLink || '#'}
                onClick={() => trackClick(banner._id)}
                className={`inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${ctaCls}`}
              >
                {banner.ctaText}
              </Link>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ─── Sidebar variant — vertical promo card ───────────────────────────────────
  if (variant === 'sidebar') {
    return (
      <div className={className}>
        <div
          className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-gray-900"
          style={{ aspectRatio: '3/4' }}
        >
          {banner.image?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner.image.url}
              alt={banner.image?.alt || banner.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: banner.backgroundColor || '#1A1A2E' }}
            />
          )}
          {/* Legibility gradient + optional overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          {overlay > 0 && (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0,0,0,${overlay})` }}
            />
          )}
          <div className="absolute inset-0 flex flex-col items-start justify-end gap-1.5 p-4">
            {banner.subtitle && (
              <p
                className="text-xs font-medium text-white/80"
                style={{ color: banner.textColor ? `${banner.textColor}cc` : undefined }}
              >
                {banner.subtitle}
              </p>
            )}
            <h3
              className="text-lg font-black leading-tight drop-shadow"
              style={{ color: banner.textColor || '#fff' }}
            >
              {banner.title}
            </h3>
            {banner.ctaText && (
              <Link
                href={banner.ctaLink || '#'}
                onClick={() => trackClick(banner._id)}
                className={`mt-1.5 inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-xs font-bold transition ${ctaCls}`}
              >
                {banner.ctaText}
                <Icon.PiArrowRightBold className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Hero variant — full image banner with positioned content ───────────────
  return (
    <div className={className}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-gray-900"
        style={{ aspectRatio: '21/9' }}
      >
        {banner.image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.image.url}
            alt={banner.image?.alt || banner.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: banner.backgroundColor || '#1A1A2E' }}
          />
        )}

        {/* Overlay */}
        {overlay > 0 && (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0,0,0,${overlay})` }}
          />
        )}

        {/* Positioned content */}
        <div className={`absolute inset-0 flex flex-col gap-2 p-5 md:p-8 ${posCls}`}>
          {banner.subtitle && (
            <p
              className="text-sm font-medium text-white/80 drop-shadow md:text-base"
              style={{ color: banner.textColor ? `${banner.textColor}cc` : undefined }}
            >
              {banner.subtitle}
            </p>
          )}
          <h2
            className="text-xl font-black drop-shadow-lg md:text-3xl"
            style={{ color: banner.textColor || '#fff' }}
          >
            {banner.title}
          </h2>
          {banner.description && (
            <p
              className="max-w-md text-sm text-white/70 drop-shadow md:text-base"
              style={{ color: banner.textColor ? `${banner.textColor}99` : undefined }}
            >
              {banner.description}
            </p>
          )}
          {banner.ctaText && (
            <div>
              <Link
                href={banner.ctaLink || '#'}
                onClick={() => trackClick(banner._id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold shadow-lg transition ${ctaCls}`}
              >
                {banner.ctaText}
                <Icon.PiArrowRightBold className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Priority badge (urgent/high only — subtle, top-right) */}
        {(banner.priority === 'urgent' || banner.priority === 'high') && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            <span className={`h-1.5 w-1.5 rounded-full ${banner.priority === 'urgent' ? 'bg-red-400' : 'bg-orange-400'}`} />
            {banner.priority}
          </span>
        )}
      </motion.div>
    </div>
  );
}