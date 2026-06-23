'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { uomConversionService } from '@/services/uomConversion.service';
import type { UOMConversion } from '@/services/uomConversion.service';

// One shared fetch of active conversions per page, mirroring use-exchange-rates.
let cache: { token: string; promise: Promise<UOMConversion[]> } | null = null;

function fetchActiveConversions(
  token: string,
  force = false
): Promise<UOMConversion[]> {
  if (!force && cache && cache.token === token) return cache.promise;
  const promise = uomConversionService
    .getConversions(token, { isActive: true, limit: 200 })
    .then((res) => (res.success ? (res.data ?? []) : []))
    .catch(() => []);
  cache = { token, promise };
  return promise;
}

const listeners = new Set<() => void>();

/** Call after creating/updating/deleting a conversion; every mounted consumer refetches. */
export function invalidateUomConversions() {
  cache = null;
  listeners.forEach((listener) => listener());
}

export function useUomConversions() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [conversions, setConversions] = useState<UOMConversion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    async (force = false) => {
      if (!token) return;
      setLoading(true);
      const data = await fetchActiveConversions(token, force);
      setConversions(data);
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

  /** Factor for a pair; falls back to the inverse pair like the server does. */
  const getFactor = useCallback(
    (from: string, to: string): number | null => {
      if (from === to) return 1;
      const direct = conversions.find(
        (c) => c.fromUOM === from && c.toUOM === to
      );
      if (direct) return direct.conversionFactor;
      const reverse = conversions.find(
        (c) => c.fromUOM === to && c.toUOM === from
      );
      if (reverse && reverse.conversionFactor > 0)
        return 1 / reverse.conversionFactor;
      return null;
    },
    [conversions]
  );

  const convert = useCallback(
    (value: number, from: string, to: string): number | null => {
      const factor = getFactor(from, to);
      return factor === null ? null : value * factor;
    },
    [getFactor]
  );

  return { conversions, loading, refresh, getFactor, convert };
}
