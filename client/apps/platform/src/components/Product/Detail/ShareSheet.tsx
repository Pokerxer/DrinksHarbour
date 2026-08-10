'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import {
  FaWhatsapp,
  FaInstagram,
  FaXTwitter,
  FaFacebookF,
  FaTelegram,
  FaEnvelope,
  FaLink,
} from 'react-icons/fa6';

type ChannelKey =
  | 'whatsapp'
  | 'instagram'
  | 'x'
  | 'facebook'
  | 'telegram'
  | 'email'
  | 'copy';

interface Channel {
  key: ChannelKey;
  label: string;
  icon: React.ReactNode;
  bg: string;
  hoverBg: string;
}

// 7 channels — flex-wrap centers the trailing 3 so no slot is left empty.
const CHANNELS: Channel[] = [
  { key: 'whatsapp',  label: 'WhatsApp',  icon: <FaWhatsapp size={22} />,   bg: 'bg-[#25D366]', hoverBg: 'hover:bg-[#1ebe5d]' },
  { key: 'instagram', label: 'Instagram', icon: <FaInstagram size={22} />,  bg: 'bg-[#E4405F]', hoverBg: 'hover:bg-[#cf3a57]' },
  { key: 'x',         label: 'X',         icon: <FaXTwitter size={22} />,   bg: 'bg-black',     hoverBg: 'hover:bg-gray-800' },
  { key: 'facebook',  label: 'Facebook',  icon: <FaFacebookF size={22} />,  bg: 'bg-[#1877F2]', hoverBg: 'hover:bg-[#1565c0]' },
  { key: 'telegram',  label: 'Telegram',  icon: <FaTelegram size={22} />,   bg: 'bg-[#229ED9]', hoverBg: 'hover:bg-[#1d8bc0]' },
  { key: 'email',     label: 'Email',     icon: <FaEnvelope size={22} />,   bg: 'bg-gray-700',  hoverBg: 'hover:bg-gray-600' },
  { key: 'copy',      label: 'Copy link', icon: <FaLink size={22} />,       bg: 'bg-gray-900',  hoverBg: 'hover:bg-gray-700' },
];

interface ShareSheetProps {
  open: boolean;
  name: string;
  /** Product name — used in the share text. */
  description?: string;
  /** URL to share. Defaults to the current page URL. */
  url?: string;
  /** Called when the user dismisses the sheet (backdrop, close, Esc, after share). */
  onClose: () => void;
}

/**
 * Share dialog for the product page. Bottom sheet on mobile, centered card on
 * desktop. Offers direct channels (WhatsApp, Instagram, X, Facebook, Telegram,
 * Email, copy link) plus the native Web Share API under "More options" — most
 * desktop browsers don't expose navigator.share, and on mobile users often
 * want a specific app; channels without a web intent (Instagram) copy instead.
 */
export default function ShareSheet({ open, name, description, url, onClose }: ShareSheetProps) {
  const [copied, setCopied] = useState<ChannelKey | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const close = useCallback(() => {
    setCopied(null);
    onClose();
  }, [onClose]);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const snippet = `Check out ${name} on DrinksHarbour!${
    description ? ` ${description.slice(0, 120)}` : ''
  }`;

  // ─── Focus management ─────────────────────────────────────────────────────
  // Move focus into the sheet on open, trap Tab inside it, restore focus to
  // the Share trigger on close.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog) {
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      (focusables[0] ?? dialog).focus();
    }
  }, [open]);

  // Lock page scroll while the sheet is open. Escape closes; Tab is trapped
  // inside the sheet so keyboard users can't tab behind the backdrop.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  const copyLink = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } catch {
      // Fallback for browsers without the async clipboard API.
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    }
  }, [shareUrl]);

  const flashCopied = useCallback((key: ChannelKey) => {
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleChannel = useCallback(
    async (ch: Channel) => {
      if (ch.key === 'copy' || ch.key === 'instagram') {
        await copyLink();
        flashCopied(ch.key);
        return;
      }

      let href = '';
      switch (ch.key) {
        case 'whatsapp':
          href = `https://wa.me/?text=${encodeURIComponent(`${snippet}\n${shareUrl}`)}`;
          break;
        case 'x':
          href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(snippet)}&url=${encodeURIComponent(shareUrl)}`;
          break;
        case 'facebook':
          href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(snippet)}`;
          break;
        case 'telegram':
          href = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(snippet)}`;
          break;
        case 'email':
          href = `mailto:?subject=${encodeURIComponent(`Check out ${name} on DrinksHarbour`)}&body=${encodeURIComponent(`${snippet}\n${shareUrl}`)}`;
          break;
        default:
          return;
      }
      window.open(href, '_blank', 'noopener,noreferrer');
      close();
    },
    [snippet, shareUrl, name, copyLink, flashCopied, close],
  );

  const handleMore = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: name,
          text: snippet,
          url: shareUrl,
        });
        close();
      } catch {
        // User dismissed the native sheet — leave the picker open.
      }
      return;
    }
    await copyLink();
    flashCopied('copy');
  }, [name, snippet, shareUrl, copyLink, flashCopied, close]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            aria-hidden="true"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 pb-6 sm:pb-5 focus:outline-none"
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id={titleId} className="text-base font-bold text-gray-900">
                Share this product
              </h3>
              <button
                type="button"
                onClick={close}
                aria-label="Close share menu"
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
              >
                <Icon.PiX size={16} />
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-x-3 gap-y-4">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => handleChannel(ch)}
                  aria-label={`Share via ${ch.label}`}
                  className="flex flex-col items-center gap-1.5 group w-[calc(25%-0.75rem)]"
                >
                  <span
                    className={`w-12 h-12 rounded-full text-white flex items-center justify-center transition-transform group-hover:scale-105 ${ch.bg} ${ch.hoverBg}`}
                  >
                    {copied === ch.key ? <Icon.PiCheck size={22} /> : ch.icon}
                  </span>
                  <span className="text-[11px] text-gray-600 font-medium leading-tight text-center">
                    {copied === ch.key ? 'Copied!' : ch.label}
                  </span>
                </button>
              ))}
            </div>

            {copied === 'instagram' && (
              <p className="mt-3 text-xs text-gray-500 text-center">
                Link copied — paste it into your Instagram DM or story.
              </p>
            )}

            <button
              type="button"
              onClick={handleMore}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-colors"
            >
              <Icon.PiShareNetwork size={18} />
              More options
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}