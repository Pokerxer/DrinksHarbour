'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import type { StockBrowserMode } from './inventory-stock-browser';

/** Each result belongs to the latest authenticated warehouse-stock request. */
export function useInventoryStockData(
  token: string,
  sessionStatus: string,
  mode: StockBrowserMode,
) {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setError('');
    if (sessionStatus === 'loading') {
      setRows([]);
      setLoading(true);
      return;
    }
    if (!token) {
      setRows([]);
      setLoading(false);
      setError('Sign in to load warehouse stock.');
      return;
    }
    setLoading(true);
    try {
      const result = await warehouseStockService.getAllStock(token, {
        includeUnstocked: mode !== 'count',
      });
      if (id === request.current) setRows(result.data ?? []);
    } catch (failure) {
      if (id === request.current) {
        setRows([]);
        setError(failure instanceof Error ? failure.message : 'Failed to load warehouse stock');
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [token, sessionStatus, mode]);
  useEffect(() => {
    setRows([]);
    void load();
    return () => {
      ++request.current;
    };
  }, [load]);
  return { rows, loading, error, load };
}
