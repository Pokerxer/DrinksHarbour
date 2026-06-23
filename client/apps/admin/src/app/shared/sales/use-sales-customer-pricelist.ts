// client/apps/admin/src/app/shared/sales/use-sales-customer-pricelist.ts
'use client';

import { useEffect, useState } from 'react';
import { posApi } from '@/app/shared/point-of-sale/api';

export interface SalesPricelistState {
  pricelists: any[];
  resolvedId: string | null;
  selected: any | null;
  loading: boolean;
}

/**
 * Resolves the pricelist a customer auto-qualifies for, with NO shop/cart
 * dependency (unlike usePOSCustomerPricelistSync, which is wired to POS's
 * jotai cart atoms). Re-fetches whenever the customer changes.
 */
export function useSalesCustomerPricelist(
  token: string,
  customerId: string
): SalesPricelistState {
  const [state, setState] = useState<SalesPricelistState>({
    pricelists: [],
    resolvedId: null,
    selected: null,
    loading: false,
  });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const res = await posApi.getPricelists(
          token,
          undefined,
          customerId || undefined
        );
        if (cancelled) return;
        const pricelists = res.pricelists || [];
        const resolvedId = res.resolvedId ?? null;
        const selected = resolvedId
          ? (pricelists.find((p: any) => p._id === resolvedId) ?? null)
          : null;
        setState({ pricelists, resolvedId, selected, loading: false });
      } catch {
        if (!cancelled)
          setState({
            pricelists: [],
            resolvedId: null,
            selected: null,
            loading: false,
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, customerId]);

  return state;
}
