'use client';

// app/shared/warehouses/warehouse-analysis/use-analysis-data.ts
//
// Data layer for the analysis page: the flattened stock feed plus the three
// metadata sources the filter panel joins against (categories, brands,
// per-SubProduct category/brand meta). Tracks an explicit phase so the UI can
// distinguish loading / ready / error instead of rendering an empty report on
// failure.

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  warehouseStockService,
  type StockRow,
} from '@/services/warehouseStock.service';
import { posApi } from '../../point-of-sale/api';
import type { BrandItem, CatItem, ProdMeta } from '../warehouse-analysis-helpers';

export type AnalysisPhase = 'loading' | 'ready' | 'error';

export function useAnalysisData() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [phase, setPhase] = useState<AnalysisPhase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [stock, setStock] = useState<StockRow[]>([]);
  const [categories, setCategories] = useState<CatItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [prodMeta, setProdMeta] = useState<Record<string, ProdMeta>>({});

  const load = useCallback(async () => {
    if (!token) {
      // Phase starts at 'loading'; clear it when no token ever arrives so a
      // signed-out visit renders the empty state rather than spinning forever.
      setPhase((p) => (p === 'loading' ? 'ready' : p));
      return;
    }
    setPhase('loading');
    try {
      const res = await warehouseStockService.getAllStock(token);
      setStock((res?.data as StockRow[]) ?? []);
      setPhase('ready');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to load warehouse stock'
      );
      setPhase('error');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Categories & brands (public endpoints) for the filter panel.
  useEffect(() => {
    posApi
      .getCategories()
      .then((d) => setCategories(d?.categories ?? []))
      .catch(() => {});
    posApi
      .getBrands({ limit: 200 })
      .then((d) => setBrands(d?.brands ?? []))
      .catch(() => {});
  }, []);

  // SubProduct → category/subcategory/brand metadata map, keyed by SubProduct
  // _id. The /product-meta endpoint is not gated by visibleInPOS, so it covers
  // non-POS items too. WarehouseStock.subProduct is the join key.
  useEffect(() => {
    if (!token) return;
    posApi
      .getProductMeta(token)
      .then((res) => {
        const rows = (res as { meta?: unknown[] })?.meta ?? [];
        const map: Record<string, ProdMeta> = {};
        for (const r of rows as Record<string, string>[]) {
          if (!r?._id) continue;
          map[String(r._id)] = {
            catId: r.categoryId || '',
            catName: r.categoryName || '',
            subCatId: r.subCategoryId || undefined,
            subCatName: r.subCategoryName || undefined,
            brandId: r.brandId || '',
            brandName: r.brandName || '',
          };
        }
        setProdMeta(map);
      })
      .catch(() => {});
  }, [token]);

  return { phase, errorMessage, stock, categories, brands, prodMeta, reload: load };
}

