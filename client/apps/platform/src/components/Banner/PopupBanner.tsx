'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Tiny class-name joiner (platform app has no cn util).
function cn(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ─── Frequency / session helpers ─────────────────────────────────────────────

const SEEN_KEY   = 'dh_popup_seen';   // localStorage: Record<bannerId, lastSeenTimestamp>
const SESSION_KEY = 'dh_popup_sess';  // sessionStorage: Set of seen banner IDs

function wasSeenThisSession(id: string): boolean {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]').includes(id); } catch { return false; }
}
function markSeenSession(id: string) {
  try {
    const arr = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
    if (!arr.includes(id)) { arr.push(id); sessionStorage.setItem(SESSION_KEY, JSON.stringify(arr)); }
  } catch {}
}
function getLastSeen(id: string): number | null {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')[id] ?? null; } catch { return null; }
}
function markSeen(id: string) {
  try {
    const map = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
    map[id] = Date.now();
    localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {}
}
function shouldShowForFrequency(id: string, frequency: string): boolean {
  if (frequency === 'every_visit')     return true;
  if (frequency === 'once_per_session') return !wasSeenThisSession(id);
  if (frequency === 'once_ever')        return getLastSeen(id) === null;
  if (frequency === 'once_per_day') {
    const last = getLastSeen(id);
    return last === null || Date.now() - last > 24 * 60 * 60 * 1000;
  }
  return true;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PopupConfig {
  trigger?: 'time_delay' | 'exit_intent' | 'scroll_depth' | 'page_load' | 'inactivity';
  delaySeconds?: number;
  scrollDepthPercent?: number;
  frequency?: 'every_visit' | 'once_per_session' | 'once_per_day' | 'once_ever';
  variant?: 'modal' | 'slide_in' | 'full_screen' | 'notification';
  position?: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  collectEmail?: boolean;
  couponCode?: string;
}

interface BannerData {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  ctaStyle?: string;
  linkType?: string;
  backgroundColor?: string;
  textColor?: string;
  overlayOpacity?: number;
  image: { url: string; alt?: string };
  endDate?: string;
  tags?: string[];
  contentPosition?: string;
  popup?: PopupConfig;
}

interface PopupBannerProps {
  /** Only render on specific pages — omit to show everywhere */
  allowedPaths?: string[];
  /** Override all fetched popups with a single preview (admin use) */
  preview?: BannerData;
}

// ─── CTA style → button classes (matches PlacementBanner) ────────────────────

const CTA_CLS: Record<string, string> = {
  primary:   'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-900/25',
  secondary: 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg',
  outline:   'bg-transparent text-white border-2 border-white hover:bg-white/10',
  text:      'text-white underline underline-offset-4 hover:decoration-2',
  custom:    'bg-gray-900 text-white hover:bg-gray-800 shadow-lg',
};

function ctaButtonClass(ctaStyle?: string): string {
  return CTA_CLS[ctaStyle || 'primary'] || CTA_CLS.primary;
}

// ─── Content position → flex alignment ────────────────────────────────────────

const POS_CLS: Record<string, string> = {
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

// ─── Countdown ────────────────────────────────────────────────────────────────

function MiniCountdown({ endDate }: { endDate: string }) {
  const [left, setLeft] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setLeft({ h: 0, m: 0, s: 0 }); return; }
      setLeft({
        h: Math.floor(diff / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        s: Math.floor((diff % 60_000) / 1000),
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endDate]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flex items-center justify-center gap-1 mt-3">
      {[['h', left.h], ['m', left.m], ['s', left.s]].map(([label, val]) => (
        <React.Fragment key={label as string}>
          <div className="flex flex-col items-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={val as number}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="block min-w-[36px] py-1.5 rounded-lg bg-black/20 text-white font-black text-lg text-center"
              >
                {pad(val as number)}
              </motion.span>
            </AnimatePresence>
            <span className="text-white/50 text-[9px] uppercase mt-0.5">{label}</span>
          </div>
          {label !== 's' && <span className="text-white/40 font-bold text-lg mb-3">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Email form ───────────────────────────────────────────────────────────────

function EmailCapture({
  bannerId,
  couponCode,
  onSuccess,
  accentColor,
}: {
  bannerId: string;
  couponCode?: string;
  onSuccess: () => void;
  accentColor: string;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/users/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'popup', bannerId }),
      });
      setDone(true);
      setTimeout(onSuccess, 2500);
    } catch {
      setDone(true); // optimistic
      setTimeout(onSuccess, 2500);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-2"
      >
        <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
          <Icon.PiCheckBold size={22} className="text-green-400" />
        </div>
        <p className="text-white font-bold text-sm">You&apos;re in!</p>
        {couponCode && (
          <div className="mt-3 px-4 py-2 bg-white/10 border border-white/20 rounded-xl">
            <p className="text-white/60 text-xs mb-1">Your discount code:</p>
            <p className="text-white font-black text-lg tracking-widest">{couponCode}</p>
          </div>
        )}
        <p className="text-white/50 text-xs mt-2">Check your inbox for confirmation.</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 mt-4">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0"
          style={{ backgroundColor: accentColor, color: '#fff' }}
        >
          {loading
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Icon.PiPaperPlaneTiltBold size={14} /> Get It</>}
        </button>
      </div>
      {error && <p className="text-red-300 text-xs">{error}</p>}
      <p className="text-white/35 text-[10px] text-center">No spam. Unsubscribe anytime.</p>
    </form>
  );
}

// ─── Single popup renderer ────────────────────────────────────────────────────

function PopupContent({
  banner,
  onClose,
}: {
  banner: BannerData;
  onClose: () => void;
}) {
  const cfg = banner.popup ?? {};
  const variant  = cfg.variant ?? 'modal';
  const position = cfg.position ?? 'center';
  const bg       = banner.backgroundColor || '#1A1A2E';
  const [imgErr, setImgErr] = useState(false);

  const trackClick = useCallback(async () => {
    try { await fetch(`${API_URL}/api/banners/${banner._id}/click`, { method: 'POST' }); } catch {}
  }, [banner._id]);

  // ── position helpers ──────────────────────────────────────────────────────
  const wrapperAlign = {
    center:        'items-center justify-center',
    'bottom-right':'items-end justify-end',
    'bottom-left': 'items-end justify-start',
    'top-right':   'items-start justify-end',
    'top-left':    'items-start justify-start',
  }[position] ?? 'items-center justify-center';

  const slideDir = position.includes('right') ? { x: 60 } : position.includes('left') ? { x: -60 } : position.includes('top') ? { y: -60 } : { y: 60 };

  // ── animation variants ────────────────────────────────────────────────────
  const modalAnim   = { hidden: { opacity: 0, scale: 0.92, y: 16 }, visible: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.9, y: 12 } };
  const slideAnim   = { hidden: { opacity: 0, ...slideDir }, visible: { opacity: 1, x: 0, y: 0 }, exit: { opacity: 0, ...slideDir } };
  const fullAnim    = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } };
  const notifAnim   = slideAnim;

  const anim = variant === 'modal' ? modalAnim : variant === 'full_screen' ? fullAnim : variant === 'notification' ? notifAnim : slideAnim;
  const transition = { type: 'spring', stiffness: 320, damping: 28 } as any;

  // ── Notification (compact) ────────────────────────────────────────────────
  if (variant === 'notification') {
    const nTxt = banner.textColor || '#fff';
    const nOverlay = (banner.overlayOpacity || 0) / 100;
    const nCta = ctaButtonClass(banner.ctaStyle);
    const posClass = {
      'bottom-right': 'bottom-5 right-5',
      'bottom-left':  'bottom-5 left-5',
      'top-right':    'top-5 right-5',
      'top-left':     'top-5 left-5',
      center:         'bottom-5 right-5',
    }[position] ?? 'bottom-5 right-5';

    return (
      <motion.div
        variants={notifAnim} initial="hidden" animate="visible" exit="exit"
        transition={transition}
        className={cn('fixed z-[9999] w-80 max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden', posClass)}
        style={{ backgroundColor: bg }}
      >
        <div className="relative p-5">
          {cfg.showCloseButton !== false && (
            <button
              onClick={onClose}
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 transition-all hover:bg-white/20 hover:text-white"
            >
              <Icon.PiXBold size={11} />
            </button>
          )}
          {!imgErr && banner.image?.url && (
            <div className="relative -mx-5 -mt-5 mb-4 h-28 overflow-hidden">
              <Image src={banner.image.url} alt={banner.image.alt || banner.title} fill className="object-cover" onError={() => setImgErr(true)} />
              {nOverlay > 0 && <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${nOverlay})` }} />}
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${bg}, transparent 60%)` }} />
            </div>
          )}
          {banner.subtitle && <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: `${nTxt}99` }}>{banner.subtitle}</p>}
          <h3 className="mb-1 text-base font-black leading-snug" style={{ color: nTxt }}>{banner.title}</h3>
          {banner.description && <p className="mb-3 text-xs leading-relaxed" style={{ color: `${nTxt}99` }}>{banner.description}</p>}
          {cfg.collectEmail
            ? <EmailCapture bannerId={banner._id} couponCode={cfg.couponCode} onSuccess={onClose} accentColor="#DC2626" />
            : banner.ctaText && (
              <Link
                href={banner.ctaLink || '#'}
                onClick={() => { trackClick(); onClose(); }}
                target={banner.linkType === 'external' ? '_blank' : undefined}
                className={cn('mt-3 block w-full rounded-xl px-4 py-2 text-center text-sm font-bold transition-all', nCta)}
              >
                {banner.ctaText}
              </Link>
            )}
        </div>
      </motion.div>
    );
  }

  // ── Full-screen ───────────────────────────────────────────────────────────
  if (variant === 'full_screen') {
    const fsTxt = banner.textColor || '#fff';
    const fsOverlay = (banner.overlayOpacity || 0) / 100;
    const fsCta = ctaButtonClass(banner.ctaStyle);
    return (
      <>
        <motion.div
          variants={fullAnim} initial="hidden" animate="visible" exit="exit"
          className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-md"
          onClick={cfg.closeOnBackdrop !== false ? onClose : undefined}
        />
        <motion.div
          variants={fullAnim} initial="hidden" animate="visible" exit="exit"
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl shadow-2xl" style={{ backgroundColor: bg }}>
            {/* Hero image */}
            {!imgErr && banner.image?.url && (
              <div className="relative h-72 md:h-96">
                <Image src={banner.image.url} alt={banner.image.alt || banner.title} fill className="object-cover object-center" priority onError={() => setImgErr(true)} />
                {fsOverlay > 0 && <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${Math.min(fsOverlay, 0.35)})` }} />}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" style={{ background: `linear-gradient(to top, ${bg} 0%, transparent 100%)` }} />
                {cfg.showCloseButton !== false && (
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md transition-all hover:bg-black/50 hover:scale-110"
                  >
                    <Icon.PiXBold size={16} />
                  </button>
                )}
              </div>
            )}
            <div className="p-8 text-center md:p-10">
              {cfg.showCloseButton !== false && imgErr && (
                <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-110">
                  <Icon.PiXBold size={16} />
                </button>
              )}
              {banner.subtitle && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider mb-4" style={{ color: `${fsTxt}bb` }}>
                  <Icon.PiSparkleFill size={10} className="text-amber-400" />
                  {banner.subtitle}
                </span>
              )}
              <h2 className="text-3xl font-black leading-tight md:text-4xl" style={{ color: fsTxt }}>{banner.title}</h2>
              {banner.description && <p className="mx-auto mt-2 max-w-md text-base leading-relaxed" style={{ color: `${fsTxt}99` }}>{banner.description}</p>}
              {banner.endDate && <MiniCountdown endDate={banner.endDate} />}
              {cfg.couponCode && !cfg.collectEmail && (
                <div className="inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 my-4">
                  <Icon.PiTagFill size={16} className="text-amber-400" />
                  <span className="font-black tracking-widest text-lg" style={{ color: fsTxt }}>{cfg.couponCode}</span>
                </div>
              )}
              {cfg.collectEmail
                ? <EmailCapture bannerId={banner._id} couponCode={cfg.couponCode} onSuccess={onClose} accentColor="#DC2626" />
                : banner.ctaText && (
                  <Link
                    href={banner.ctaLink || '#'}
                    onClick={() => { trackClick(); onClose(); }}
                    target={banner.linkType === 'external' ? '_blank' : undefined}
                    className={cn('inline-flex items-center gap-2 rounded-2xl px-10 py-4 text-sm font-black transition-all mt-4', fsCta)}
                  >
                    {banner.ctaText} <Icon.PiArrowRight size={15} />
                  </Link>
                )}
              <button onClick={onClose} className="mx-auto mt-4 block text-xs transition-colors hover:underline" style={{ color: `${fsTxt}55` }}>
                No thanks, I&apos;ll skip
              </button>
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  // ── Slide-in ──────────────────────────────────────────────────────────────
  if (variant === 'slide_in') {
    const siTxt = banner.textColor || '#fff';
    const siOverlay = (banner.overlayOpacity || 0) / 100;
    const siCta = ctaButtonClass(banner.ctaStyle);
    const posClass = {
      'bottom-right': 'bottom-6 right-6',
      'bottom-left':  'bottom-6 left-6',
      'top-right':    'top-20 right-6',
      'top-left':     'top-20 left-6',
      center:         'bottom-6 right-6',
    }[position] ?? 'bottom-6 right-6';

    return (
      <motion.div
        variants={slideAnim} initial="hidden" animate="visible" exit="exit"
        transition={transition}
        className={cn('fixed z-[9999] w-80 max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden sm:w-96', posClass)}
        style={{ backgroundColor: bg }}
      >
        {!imgErr && banner.image?.url && (
          <div className="relative h-36 overflow-hidden">
            <Image src={banner.image.url} alt={banner.image.alt || banner.title} fill className="object-cover" onError={() => setImgErr(true)} />
            {siOverlay > 0 && <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${siOverlay})` }} />}
            <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${bg}, transparent 50%)` }} />
          </div>
        )}
        <div className="relative p-5">
          {cfg.showCloseButton !== false && (
            <button
              onClick={onClose}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-white/20 hover:text-white"
            >
              <Icon.PiXBold size={12} />
            </button>
          )}
          {banner.subtitle && <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${siTxt}99` }}>{banner.subtitle}</p>}
          <h3 className="pr-8 text-base font-black leading-tight" style={{ color: siTxt }}>{banner.title}</h3>
          {banner.description && <p className="mt-1 text-xs leading-relaxed" style={{ color: `${siTxt}99` }}>{banner.description}</p>}
          {banner.endDate && <MiniCountdown endDate={banner.endDate} />}
          {cfg.couponCode && !cfg.collectEmail && (
            <div className="my-3 flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2">
              <Icon.PiTagFill size={13} className="text-amber-400 flex-shrink-0" />
              <span className="text-sm font-black tracking-widest" style={{ color: siTxt }}>{cfg.couponCode}</span>
            </div>
          )}
          {cfg.collectEmail
            ? <EmailCapture bannerId={banner._id} couponCode={cfg.couponCode} onSuccess={onClose} accentColor="#DC2626" />
            : banner.ctaText && (
              <Link
                href={banner.ctaLink || '#'}
                onClick={() => { trackClick(); onClose(); }}
                target={banner.linkType === 'external' ? '_blank' : undefined}
                className={cn('mt-3 block w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold transition-all', siCta)}
              >
                {banner.ctaText} →
              </Link>
            )}
        </div>
      </motion.div>
    );
  }

  // ── Modal (default) ───────────────────────────────────────────────────────
  const txtColor = banner.textColor || '#fff';
  const overlay = (banner.overlayOpacity || 0) / 100;
  const posCls = POS_CLS[banner.contentPosition || 'center'] || POS_CLS.center;
  const ctaCls = ctaButtonClass(banner.ctaStyle);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-md"
        onClick={cfg.closeOnBackdrop !== false ? onClose : undefined}
      />

      {/* Dialog */}
      <motion.div
        variants={modalAnim} initial="hidden" animate="visible" exit="exit"
        transition={transition}
        className={`fixed z-[9999] inset-0 flex ${wrapperAlign} p-4`}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-3xl shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ backgroundColor: bg }}
        >
          {/* Image strip */}
          {!imgErr && banner.image?.url && (
            <div className="relative h-72 overflow-hidden sm:h-80 md:h-96">
              <Image
                src={banner.image.url}
                alt={banner.image.alt || banner.title}
                fill
                className="object-cover object-center"
                priority
                onError={() => setImgErr(true)}
              />
              {/* Overlay opacity — capped so the product never washes out */}
              {overlay > 0 && (
                <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${Math.min(overlay, 0.35)})` }} />
              )}
              {/* Soft fade confined to the bottom third — keeps the product vivid up top while blending into the content */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" style={{ background: `linear-gradient(to top, ${bg} 0%, transparent 100%)` }} />
              {/* Discount badge */}
              {banner.tags?.some(t => t.includes('%')) && (
                <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-gradient-to-br from-red-600 to-red-700 text-white px-3.5 py-2 rounded-2xl font-black text-lg shadow-lg backdrop-blur-sm">
                  {banner.tags.find(t => t.includes('%'))}
                </div>
              )}
            </div>
          )}

          {/* Close button */}
          {cfg.showCloseButton !== false && (
            <button
              onClick={onClose}
              aria-label="Close popup"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md transition-all hover:bg-black/50 hover:scale-110"
            >
              <Icon.PiXBold size={16} />
            </button>
          )}

          {/* Content — positioned per contentPosition */}
          <div className={cn('flex flex-col gap-2.5 p-7 md:p-8', posCls)}>
            {banner.subtitle && (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: `${txtColor}bb` }}>
                <Icon.PiSparkleFill size={9} className="text-amber-400" />
                {banner.subtitle}
              </span>
            )}

            <h2 className="text-2xl font-black leading-tight md:text-3xl" style={{ color: txtColor }}>
              {banner.title}
            </h2>

            {banner.description && (
              <p className="max-w-sm text-sm leading-relaxed" style={{ color: `${txtColor}99` }}>
                {banner.description}
              </p>
            )}

            {banner.endDate && <MiniCountdown endDate={banner.endDate} />}

            {cfg.couponCode && !cfg.collectEmail && (
              <div className="inline-flex w-fit items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 my-2">
                <Icon.PiTagFill size={15} className="text-amber-400" />
                <span className="font-black tracking-widest" style={{ color: txtColor }}>{cfg.couponCode}</span>
              </div>
            )}

            {cfg.collectEmail ? (
              <EmailCapture bannerId={banner._id} couponCode={cfg.couponCode} onSuccess={onClose} accentColor="#DC2626" />
            ) : banner.ctaText ? (
              <Link
                href={banner.ctaLink || '#'}
                onClick={() => { trackClick(); onClose(); }}
                target={banner.linkType === 'external' ? '_blank' : undefined}
                className={cn('inline-flex w-fit items-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-black transition-all', ctaCls)}
              >
                {banner.ctaText} <Icon.PiArrowRight size={14} />
              </Link>
            ) : null}

            <button
              onClick={onClose}
              className="mt-3 text-xs transition-colors hover:underline"
              style={{ color: `${txtColor}55` }}
            >
              No thanks
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PopupBanner({ allowedPaths, preview }: PopupBannerProps) {
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [visible, setVisible]   = useState<BannerData | null>(null);
  const [queue, setQueue]       = useState<BannerData[]>([]);
  const triggeredRef            = useRef<Set<string>>(new Set());

  // ── Fetch banners ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (preview) { setBanners([preview]); return; }
    fetch(`${API_URL}/api/banners/placement/popup?limit=5`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.success && data.data?.length) setBanners(data.data); })
      .catch(() => {});
  }, [preview]);

  // ── Path filter ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!banners.length) return;

    const path = window.location.pathname;
    const eligible = banners.filter(b => {
      if (allowedPaths && !allowedPaths.some(p => path.startsWith(p))) return false;
      const freq = b.popup?.frequency ?? 'once_per_session';
      return shouldShowForFrequency(b._id, freq);
    });

    if (eligible.length) setQueue(eligible);
  }, [banners, allowedPaths]);

  // ── Register triggers for each banner in queue ─────────────────────────────
  useEffect(() => {
    if (!queue.length) return;

    const cleanups: (() => void)[] = [];

    queue.forEach(banner => {
      if (triggeredRef.current.has(banner._id)) return;
      const cfg = banner.popup ?? {};
      const trigger = cfg.trigger ?? 'time_delay';
      const delay   = (cfg.delaySeconds ?? 3) * 1000;

      const show = () => {
        if (triggeredRef.current.has(banner._id)) return;
        triggeredRef.current.add(banner._id);
        setVisible(banner);
        // Track impression
        fetch(`${API_URL}/api/banners/${banner._id}/impression`, { method: 'POST' }).catch(() => {});
      };

      if (trigger === 'page_load') {
        show();
      } else if (trigger === 'time_delay') {
        const t = setTimeout(show, delay);
        cleanups.push(() => clearTimeout(t));
      } else if (trigger === 'inactivity') {
        let timer = setTimeout(show, delay);
        const reset = () => { clearTimeout(timer); timer = setTimeout(show, delay); };
        ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(ev => window.addEventListener(ev, reset, { passive: true }));
        cleanups.push(() => {
          clearTimeout(timer);
          ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(ev => window.removeEventListener(ev, reset));
        });
      } else if (trigger === 'scroll_depth') {
        const depth = (cfg.scrollDepthPercent ?? 50) / 100;
        const onScroll = () => {
          const scrolled = (document.documentElement.scrollTop + window.innerHeight) / document.documentElement.scrollHeight;
          if (scrolled >= depth) show();
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        cleanups.push(() => window.removeEventListener('scroll', onScroll));
      } else if (trigger === 'exit_intent') {
        const onMouseOut = (e: MouseEvent) => {
          if (e.clientY <= 5) show();
        };
        document.addEventListener('mouseleave', onMouseOut);
        cleanups.push(() => document.removeEventListener('mouseleave', onMouseOut));
      }
    });

    return () => cleanups.forEach(fn => fn());
  }, [queue]);

  // ── Close handler ─────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (!visible) return;
    // Mark seen for frequency tracking
    const freq = visible.popup?.frequency ?? 'once_per_session';
    markSeenSession(visible._id);
    if (freq !== 'every_visit') markSeen(visible._id);

    setVisible(null);

    // Show next in queue after a short pause
    setQueue(prev => {
      const remaining = prev.filter(b => b._id !== visible._id && !triggeredRef.current.has(b._id));
      if (remaining.length) {
        setTimeout(() => setVisible(remaining[0]), 600);
      }
      return remaining;
    });
  }, [visible]);

  // ── Keyboard: Escape ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, handleClose]);

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <PopupContent
          key={visible._id}
          banner={visible}
          onClose={handleClose}
        />
      )}
    </AnimatePresence>
  );
}
