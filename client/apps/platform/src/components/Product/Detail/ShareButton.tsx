'use client';

import React, { useCallback, useEffect, useState } from 'react';
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

interface ShareButtonProps {
  /** Product name — used in the share text and as the aria-label. */
  name: string;
  /** Short product description, appended to the share text (truncated). */
  description?: string;
  /** Extra classes for the trigger button (defaults to the action-row style). */
  className?: string;
}

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

const CHANNELS: Channel[] = [
  { key: 'whatsapp',  label: 'WhatsApp',  icon: <FaWhatsapp size={22} />,   bg: 'bg-[#25D366]', hoverBg: 'hover:bg-[#1ebe5d]' },
  { key: 'instagram', label: 'Instagram', icon: <FaInstagram size={22} />,  bg: 'bg-[#E4405F]', hoverBg: 'hover:bg-[#cf3a57]' },
  { key: 'x',         label: 'X',         icon: <FaXTwitter size={22} />,   bg: 'bg-black',     hoverBg: 'hover:bg-gray-800' },
  { key: 'facebook',  label: 'Facebook',  icon: <FaFacebookF size={22} />,  bg: 'bg-[#1877F2]', hoverBg: 'hover:bg-[#1565c0]' },
  { key: 'telegram',  label: 'Telegram',  icon: <FaTelegram size={22} />,   bg: 'bg-[#229ED9]', hoverBg: 'hover:bg-[#1d8bc0]' },
  { key: 'email',     label: 'Email',     icon: <FaEnvelope size={22} />,   bg: 'bg-gray-700',  hoverBg: 'hover:bg-gray-600' },
  { key: 'copy',      label: 'Copy link', icon: <FaLink size={22} />,       bg: 'bg-gray-900',  hoverBg: 'hover:bg-gray-700' },
];

/**
 * "Share this product" button. Opens a channel picker (WhatsApp, Instagram, X,
 * Facebook, Telegram, Email, copy link) instead of relying solely on the
 * native Web Share API — most desktop browsers don't expose it, and even on
 * mobile users often want a specific app. The native sheet stays available
 * under "More options" (and is the fallback when channels lack a web intent,
 * e.g. Instagram, which copies the link instead).
 */
export default function ShareButton({ name, description, className = '' }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<ChannelKey | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setCopied(null);
  }, []);

  // Escape closes; backdrop click closes; scroll is locked while open so the
  // product page doesn't scroll behind the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  const snippet = `Check out ${name} on DrinksHarbour!${
    description ? ` ${description.slice(0, 120)}` : ''
  }`;

  const copyLink = useCallback(async (): Promise<boolean> => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Fallback for browsers without the async clipboard API.
      const ta = document.createElement('textarea');
      ta.value = url;
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
  }, []);

  const flashCopied = useCallback((key: ChannelKey) => {
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleChannel = useCallback(
    async (ch: Channel) => {
      const url = window.location.href;

      // Copy-based channels (no public web share intent for Instagram).
      if (ch.key === 'copy' || ch.key === 'instagram') {
        await copyLink();
        flashCopied(ch.key);
        return;
      }

      let href = '';
      switch (ch.key) {
        case 'whatsapp':
          href = `https://wa.me/?text=${encodeURIComponent(`${snippet}\n${url}`)}`;
          break;
        case 'x':
          href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(snippet)}&url=${encodeURIComponent(url)}`;
          break;
        case 'facebook':
          href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(snippet)}`;
          break;
        case 'telegram':
          href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(snippet)}`;
          break;
        case 'email':
          href = `mailto:?subject=${encodeURIComponent(`Check out ${name} on DrinksHarbour`)}&body=${encodeURIComponent(`${snippet}\n${url}`)}`;
          break;
        default:
          return;
      }
      window.open(href, '_blank', 'noopener,noreferrer');
      close();
    },
    [snippet, name, copyLink, flashCopied, close],
  );

  const handleMore = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: name,
          text: snippet,
          url: window.location.href,
        });
        close();
      } catch {
        // User dismissed the native sheet — leave the picker open.
      }
      return;
    }
    await copyLink();
    flashCopied('copy');
  }, [name, snippet, copyLink, flashCopied, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Share ${name}`}
        className={
          className ||
          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-medium transition-all'
        }
      >
        <Icon.PiShareNetwork size={18} />
        Share
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Share ${name}`}
        >
          <div className="absolute inset-0 bg-black/50" onClick={close} aria-hidden="true" />

          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 pb-6 sm:pb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Share this product</h3>
              <button
                type="button"
                onClick={close}
                aria-label="Close share menu"
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
              >
                <Icon.PiX size={16} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-x-3 gap-y-4">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => handleChannel(ch)}
                  aria-label={`Share via ${ch.label}`}
                  className="flex flex-col items-center gap-1.5 group"
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
          </div>
        </div>
      )}
    </>
  );
}
