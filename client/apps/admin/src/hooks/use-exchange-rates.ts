'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { exchangeRateService } from '@/services/exchangeRate.service';
import { resolveRate } from '@/app/shared/purchases/exchange-rates-helpers';
import { BASE_CURRENCY } from '@/app/shared/purchases/types';

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

  /**
   * Latest rate for a pair: direct, then inverse (matching the server), then
   * triangulated through the base currency so pairs like EUR→USD still
   * convert when only their base legs exist.
   */
  const getRate = useCallback(
    (from: string, to: string): number | null =>
      resolveRate(latestRates, from, to, BASE_CURRENCY),
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
