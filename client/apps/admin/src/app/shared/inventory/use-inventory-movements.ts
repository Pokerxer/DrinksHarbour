'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import { PRESETS, type MovesPresetKey } from './inventory-movements-presets';
import { movementBounds } from './inventory-movement-view';
export function useInventoryMovements(
  token: string,
  status: string,
  presetKey: MovesPresetKey,
  from: string,
  to: string,
  startTime: string,
  endTime: string,
) {
  const [moves, setMoves] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const request = useRef(0);
  const fetchMoves = useCallback(async () => {
    const id = ++request.current;
    setMoves([]);
    setTruncated(false);
    setError(null);
    setLoading(true);
    if (status === 'loading') return;
    const bounds = movementBounds(from, to, startTime, endTime);
    if (!token || bounds.error) {
      setLoading(false);
      setError(bounds.error || 'Sign in to load movement history.');
      return;
    }
    try {
      const preset = PRESETS[presetKey];
      const result = await inventoryService.getAllMovements(token, {
        category: preset.category,
        scope: preset.scope,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        startDate: bounds.start === undefined ? undefined : new Date(bounds.start).toISOString(),
        endDate: bounds.end === undefined ? undefined : new Date(bounds.end).toISOString(),
      });
      if (id !== request.current) return;
      setMoves(
        preset.types
          ? result.movements.filter((m) => preset.types!.includes(m.type))
          : result.movements,
      );
      setTruncated(result.truncated);
    } catch (error) {
      if (id === request.current)
        setError(error instanceof Error ? error.message : 'Failed to load movement history.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [token, status, presetKey, from, to, startTime, endTime]);
  useEffect(() => {
    void fetchMoves();
    return () => {
      ++request.current;
    };
  }, [fetchMoves]);
  return { moves, loading, errorMsg, truncated, fetchMoves };
}
