// client/apps/admin/src/app/shared/sales/use-sales-customer-pricelist.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { posApi } from '@/app/shared/point-of-sale/api';

export interface SalesPricelistState {
  pricelists: any[];
  resolvedId: string | null;
  selected: any | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Resolves the pricelist a customer auto-qualifies for, with NO shop/cart
 * dependency (unlike usePOSCustomerPricelistSync, which is wired to POS's
 * jotai cart atoms). Re-fetches whenever the customer changes.
 */
export function useSalesCustomerPricelist(
  token: string,
  customerId: string,
  warehouseId?: string
): SalesPricelistState {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const [state, setState] = useState<Omit<SalesPricelistState, 'retry'>>({
    pricelists: [],
    resolvedId: null,
    selected: null,
    loading: !!token,
    error: null,
  });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await posApi.getPricelists(
          token,
          undefined,
          customerId || undefined,
          warehouseId || undefined
        );
        if (cancelled) return;
        const pricelists = res.pricelists || [];
        const resolvedId = res.resolvedId ?? null;
        const selected = resolvedId
          ? (pricelists.find((p: any) => p._id === resolvedId) ?? null)
          : null;
        setState({
          pricelists,
          resolvedId,
          selected,
          loading: false,
          error: null,
        });
      } catch {
        if (!cancelled)
          setState({
            pricelists: [],
            resolvedId: null,
            selected: null,
            loading: false,
            error: 'Could not load pricelists.',
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, customerId, warehouseId, attempt]);

  return token
    ? { ...state, retry }
    : {
        pricelists: [],
        resolvedId: null,
        selected: null,
        loading: false,
        error: null,
        retry,
      };
}
