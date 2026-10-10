'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import { posApi } from '../../point-of-sale/api';
import type { ProdMeta } from '../warehouse-analysis-helpers';

export type AnalysisPhase = 'loading' | 'ready' | 'error';

export function useAnalysisData(warehouseId?: string) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [phase, setPhase] = useState<AnalysisPhase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [stock, setStock] = useState<StockRow[]>([]);
  const [prodMeta, setProdMeta] = useState<Record<string, ProdMeta>>({});
  const request = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    if (!token) {
      setStock([]);
      setProdMeta({});
      setPhase('ready');
      return;
    }
    setPhase('loading');
    setErrorMessage('');
    try {
      // Category/brand filters must not run against a partially loaded report.
      const [stockResponse, metadata] = await Promise.all([
        warehouseStockService.getAllStock(token),
        posApi.getProductMeta(token),
      ]);
      if (current !== request.current) return;
      const map: Record<string, ProdMeta> = {};
      for (const row of metadata.meta || []) {
        if (!row._id) continue;
        map[String(row._id)] = {
          catId: row.categoryId || '',
          catName: row.categoryName || '',
          subCatId: row.subCategoryId || undefined,
          subCatName: row.subCategoryName || undefined,
          brandId: row.brandId || '',
          brandName: row.brandName || '',
        };
      }
      setStock(
        (stockResponse.data || []).filter((row) => !warehouseId || row.warehouseId === warehouseId),
      );
      setProdMeta(map);
      setPhase('ready');
    } catch (error: unknown) {
      if (current !== request.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load warehouse analysis');
      setPhase('error');
    }
  }, [token, warehouseId]);

  useEffect(() => {
    load();
    return () => {
      ++request.current;
    };
  }, [load]);

  return { phase, errorMessage, stock, prodMeta, reload: load };
}
