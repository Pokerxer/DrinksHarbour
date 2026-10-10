'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
export function useStockProductHistory(
  token: string,
  product: string,
  quantity: number,
  from: string,
  to: string,
) {
  const [moves, setMoves] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setMoves([]);
    setError('');
    setTruncated(false);
    if (!token || !product) {
      setLoading(false);
      setError('Sign in to load product history.');
      return;
    }
    if (from && to && from > to) {
      setLoading(false);
      setError('The start date must be on or before the end date.');
      return;
    }
    setLoading(true);
    try {
      const result = await inventoryService.getAllMovements(token, {
        subProductId: product,
        startDate: from ? `${from}T00:00:00.000Z` : undefined,
        endDate: to ? `${to}T23:59:59.999Z` : undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      if (id === request.current) {
        setMoves(result.movements);
        setTruncated(result.truncated);
      }
    } catch (failure) {
      if (id === request.current)
        setError(failure instanceof Error ? failure.message : 'Failed to load product history');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [token, product, quantity, from, to]);
  useEffect(() => {
    void load();
    return () => {
      ++request.current;
    };
  }, [load]);
  return { moves, loading, error, truncated, load };
}
