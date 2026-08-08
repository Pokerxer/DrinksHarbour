'use client';

/**
 * Advertises free delivery on a customer's first purchase.
 *
 * Two presentations of one verdict: a slim dismissible strip for the header, and
 * a card for the cart page. Both read the shared probe, and both stay hidden for
 * anyone who cannot actually claim the offer — see `describeFirstOrderPerk`.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { useFirstOrderPerk } from '@/context/FirstOrderPerkContext';
import { describeFirstOrderPerk } from '@/lib/first-order-perk';

const DISMISS_KEY = 'dh_first_order_perk_dismissed';

interface Props {
  /** `bar` for the site-wide header strip, `card` for the cart page. */
  variant?: 'bar' | 'card';
  /** Cart subtotal, so a shopper below the minimum sees the exact shortfall. */
  subtotal?: number;
  /** Where to return after signing in. */
  returnTo?: string;
}

const FirstOrderPerkBanner: React.FC<Props> = ({
  variant = 'card',
  subtotal,
  returnTo = '/checkout',
}) => {
  const { perk, loading } = useFirstOrderPerk();
  const [dismissed, setDismissed] = useState(true); // assume dismissed until localStorage says otherwise
  const [mounted, setMounted] = useState(false);

  // Read the dismissal after mount so the server-rendered markup and the first
  // client render agree; reading localStorage during render would mismatch.
  useEffect(() => {
    setMounted(true);
    if (variant !== 'bar') { setDismissed(false); return; }
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, [variant]);

  const promo = describeFirstOrderPerk(perk, { subtotal, returnTo });

  if (!mounted || loading || !promo.show || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode — forget it */ }
  };

  const success = promo.tone === 'success';

  // ── Header strip ──────────────────────────────────────────────────────────
  if (variant === 'bar') {
    return (
      <div
        className={`w-full ${success ? 'bg-green-600' : 'bg-black'} text-white`}
        role="status"
      >
        <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 sm:gap-3 text-center">
          <Icon.PiTruckBold size={16} className="flex-shrink-0" aria-hidden="true" />
          <p className="text-xs sm:text-sm leading-snug">
            <span className="font-bold">{promo.headline}</span>
            <span className="hidden sm:inline"> — {promo.detail}</span>
          </p>
          {promo.cta && (
            <Link
              href={promo.cta.href}
              className="text-xs sm:text-sm font-bold underline underline-offset-2 whitespace-nowrap hover:opacity-80"
            >
              {promo.cta.label}
            </Link>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss offer"
            className="ml-1 sm:ml-2 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            <Icon.PiXBold size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // ── Cart / checkout card ──────────────────────────────────────────────────
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border p-3 sm:p-4 ${
        success
          ? 'border-green-200 bg-green-50'
          : 'border-blue-200 bg-blue-50'
      }`}
    >
      <Icon.PiTruckBold
        size={20}
        className={`mt-0.5 flex-shrink-0 ${success ? 'text-green-600' : 'text-blue-600'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${success ? 'text-green-800' : 'text-blue-900'}`}>
          {promo.headline}
        </p>
        <p className={`mt-0.5 text-xs sm:text-sm ${success ? 'text-green-700' : 'text-blue-700'}`}>
          {promo.detail}
        </p>
      </div>
      {promo.cta && (
        <Link
          href={promo.cta.href}
          className="flex-shrink-0 self-center rounded-lg bg-black px-3 py-2 text-xs font-bold text-white hover:bg-gray-800 transition-colors"
        >
          {promo.cta.label}
        </Link>
      )}
    </div>
  );
};

export default FirstOrderPerkBanner;
