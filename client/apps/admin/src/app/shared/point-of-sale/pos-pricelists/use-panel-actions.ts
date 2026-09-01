'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { Pricelist, PricelistRule, SubProductLite } from './types';
import { pricelistService } from '@/services/pricelist.service';
import { subproductService } from '@/services/subproduct.service';
import { warehouseService } from '@/services/warehouse.service';
import { posApi } from '@/app/shared/point-of-sale/api';

interface Args {
  pl: Pricelist;
  token?: string;
  onRefresh(): void;
}

/**
 * Product catalogue loading + rule CRUD/apply actions for PricelistPanel.
 *
 * There is deliberately no reorder action: priority is derived server-side
 * (services/pricelistPriority.service) and reassigned on every rule mutation.
 * `PATCH /:id/rules/reorder` still exists as a manual escape hatch if the
 * ranking ever gets a case wrong — it is simply not wired to the UI.
 */
export function usePanelActions({ pl, token, onRefresh }: Args) {
  const [products, setProducts] = useState<SubProductLite[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [productsRetry, setProductsRetry] = useState(0);
  const [applying, setApplying] = useState(false);
  const [shopOptions, setShopOptions] = useState<
    { _id: string; name: string }[]
  >([]);
  const [whOptions, setWhOptions] = useState<{ _id: string; name: string }[]>(
    []
  );

  // Shop + warehouse options for binding selectors
  useEffect(() => {
    if (!token) return;
    const builtins = [
      { _id: 'retail', name: 'Retail (built-in)' },
      { _id: 'wholesale', name: 'Wholesale (built-in)' },
    ];
    posApi
      .listShops(token)
      .then((r: { shops?: { _id: string; name: string }[] }) => {
        const custom = (r?.shops || []).map((s) => ({
          _id: String(s._id),
          name: s.name,
        }));
        setShopOptions([...builtins, ...custom]);
      })
      .catch(() => setShopOptions(builtins));
    warehouseService
      .getWarehouses(token, { isActive: true })
      .then((r: unknown) => {
        const res = r as {
          data?: unknown;
          warehouses?: { _id: string; name: string }[];
        };
        const list = Array.isArray(res?.data)
          ? (res.data as { _id: string; name: string }[])
          : ((res?.data as { warehouses?: { _id: string; name: string }[] })
              ?.warehouses ??
            res?.warehouses ??
            []);
        setWhOptions(list.map((w) => ({ _id: String(w._id), name: w.name })));
      })
      .catch(() => setWhOptions([]));
  }, [token]);

  // Eager product catalogue load with visible error + retry
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setProductsLoading(true);
    setProductsError('');
    subproductService
      .getSubProducts(token, { limit: 500 })
      .then((r: unknown) => {
        if (cancelled) return;
        const res = r as {
          data?: { subProducts?: SubProductLite[] };
          subProducts?: SubProductLite[];
        };
        setProducts(res?.data?.subProducts || res?.subProducts || []);
      })
      .catch(() => {
        if (!cancelled) setProductsError('Could not load products');
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, productsRetry]);

  async function applyPrices() {
    const activeRules = (pl?.rules || []).filter(
      (r) => !r.endDate || new Date(r.endDate) >= new Date()
    );
    if (activeRules.length === 0) {
      toast.error('No active rules to apply');
      return;
    }
    setApplying(true);
    try {
      const res = await pricelistService.apply(pl._id, token!);
      const d = res.data as {
        message?: string;
        modified: number;
        skipped: number;
        errors?: unknown[];
      };
      toast.success(
        d.message ||
          `${d.modified} product${d.modified === 1 ? '' : 's'} updated`
      );
      if (d.skipped > 0)
        toast(`${d.skipped} rule${d.skipped === 1 ? '' : 's'} skipped`, {
          icon: '⚠️',
        });
      if ((d.errors?.length ?? 0) > 0)
        toast.error(
          `${d.errors!.length} rule${d.errors!.length === 1 ? '' : 's'} failed`
        );
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  /** Resolves after server write; rethrows so the modal can surface field errors. */
  async function addRule(rule: Record<string, unknown>, keepOpen: boolean) {
    await pricelistService.addRule(pl._id, rule, token!);
    toast.success('Rule added');
    if (!keepOpen) return true;
    return false;
  }

  async function persistRule(ruleId: string, rule: Record<string, unknown>) {
    await pricelistService.updateRule(pl._id, ruleId, rule, token!);
    toast.success('Rule updated');
  }

  async function removeRule(ruleId: string): Promise<boolean> {
    try {
      await pricelistService.deleteRule(pl._id, ruleId, token!);
      toast.success('Rule removed');
      onRefresh();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  }

  return {
    products,
    shopOptions,
    whOptions,
    productsLoading,
    productsError,
    retryProducts: () => setProductsRetry((n) => n + 1),
    applying,
    applyPrices,
    addRule,
    persistRule,
    removeRule,
  };
}
