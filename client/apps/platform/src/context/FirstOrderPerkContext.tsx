'use client';

/**
 * Eligibility for free delivery on a customer's first purchase.
 *
 * Three surfaces advertise this offer — the header bar, the cart banner and the
 * signed-out nudge at checkout — and all three ask the same question. Holding
 * the answer here means one request per session instead of one per surface, and
 * one place to refetch from when the customer signs in or places an order.
 *
 * The verdict is server-side and authoritative; this is a display hint only.
 * Checkout gets a sharper answer (one that knows the delivery address and the
 * real fee) from /api/shipping/calculate, and the order write recomputes it
 * again, so nothing here can grant a discount on its own.
 */

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import type { FirstOrderPerkProbe } from 'commerce-core';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface FirstOrderPerkContextValue {
  perk: FirstOrderPerkProbe | null;
  loading: boolean;
  /** Re-ask the server — call after an order is placed. */
  refresh: () => void;
}

const FirstOrderPerkContext = createContext<FirstOrderPerkContextValue>({
  perk: null,
  loading: true,
  refresh: () => {},
});

export const FirstOrderPerkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [perk, setPerk] = useState<FirstOrderPerkProbe | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`${API_URL}/api/shipping/first-order-perk`, {
      // Auth is httpOnly-cookie based, so without this the server sees a guest
      // and nobody is ever eligible.
      credentials: 'include',
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setPerk(d?.success ? (d.data as FirstOrderPerkProbe) : null);
      })
      // A failed probe hides the promo rather than showing a stale or wrong one.
      .catch(() => { if (!cancelled) setPerk(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // Signing in or out changes the answer, so the probe reruns on auth change.
  }, [isAuthenticated, nonce]);

  return (
    <FirstOrderPerkContext.Provider value={{ perk, loading, refresh }}>
      {children}
    </FirstOrderPerkContext.Provider>
  );
};

export const useFirstOrderPerk = (): FirstOrderPerkContextValue =>
  useContext(FirstOrderPerkContext);

export default FirstOrderPerkContext;
