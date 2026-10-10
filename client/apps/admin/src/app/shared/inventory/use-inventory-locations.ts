'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
const message = (failure: unknown) =>
  failure instanceof Error ? failure.message : 'Unable to load data. Please retry.';
export function useInventoryLocations(token: string, status: string) {
  const request = useRef(0);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockError, setStockError] = useState('');
  const load = useCallback(async () => {
    const id = ++request.current;
    setWarehouses([]);
    setStock([]);
    setError('');
    setStockError('');
    if (status === 'loading') {
      setLoading(true);
      return;
    }
    if (!token) {
      setLoading(false);
      setError('Sign in to view inventory locations.');
      return;
    }
    setLoading(true);
    const [locations, quantities] = await Promise.allSettled([
      warehouseService.getWarehouses(token),
      warehouseStockService.getAllStock(token, { includeUnstocked: true }),
    ]);
    if (id !== request.current) return;
    if (locations.status === 'fulfilled') {
      const result = locations.value as { data?: Warehouse[] };
      setWarehouses(result.data || []);
    } else setError(message(locations.reason));
    if (quantities.status === 'fulfilled') setStock(quantities.value.data || []);
    else setStockError(message(quantities.reason));
    setLoading(false);
  }, [token, status]);
  useEffect(() => {
    void load();
    return () => {
      ++request.current;
    };
  }, [load]);
  return { warehouses, stock, loading, error, stockError, load };
}
