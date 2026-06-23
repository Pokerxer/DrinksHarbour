'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { exchangeRateService } from '@/services/exchangeRate.service';

export interface LatestRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
}

// One in-flight/resolved fetch shared by every consumer on the page, so the
// PO summary, bill totals, etc. don't each hit /exchange-rates/latest.
let cache: { token: string; promise: Promise<LatestRate[]> } | null = null;

function fetchLatestRates(token: string, force = false): Promise<LatestRate[]> {
  if (!force && cache && cache.token === token) return cache.promise;
  const promise = exchangeRateService
    .getLatestRates(token)
    .then((res) =>
      res.success ? ((res.data as unknown as LatestRate[]) ?? []) : []
    )
    .catch(() => []);
  cache = { token, promise };
  return promise;
}

const listeners = new Set<() => void>();

/** Call after creating/updating/deleting a rate; every mounted consumer refetches. */
export function invalidateExchangeRates() {
  cache = null;
  listeners.forEach((listener) => listener());
}

export function useExchangeRates() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [latestRates, setLatestRates] = useState<LatestRate[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    async (force = false) => {
      if (!token) return;
      setLoading(true);
      const data = await fetchLatestRates(token, force);
      setLatestRates(data);
      setLoading(false);
    },
    [token]
  );

  useEffect(() => {
    refresh();
    const onInvalidate = () => refresh();
    listeners.add(onInvalidate);
    return () => {
      listeners.delete(onInvalidate);
    };
  }, [refresh]);

  /** Latest rate for a pair; falls back to the inverse pair like the server does. */
  const getRate = useCallback(
    (from: string, to: string): number | null => {
      if (from === to) return 1;
      const direct = latestRates.find(
        (r) => r.fromCurrency === from && r.toCurrency === to
      );
      if (direct) return direct.rate;
      const reverse = latestRates.find(
        (r) => r.fromCurrency === to && r.toCurrency === from
      );
      if (reverse && reverse.rate > 0) return 1 / reverse.rate;
      return null;
    },
    [latestRates]
  );

  const convert = useCallback(
    (amount: number, from: string, to: string): number | null => {
      const rate = getRate(from, to);
      return rate === null ? null : amount * rate;
    },
    [getRate]
  );

  return { latestRates, loading, refresh, getRate, convert };
}
