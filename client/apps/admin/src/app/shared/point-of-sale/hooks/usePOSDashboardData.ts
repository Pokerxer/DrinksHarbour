'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadDashboardData, type DashboardResult } from '../dashboard-data';

const empty = (): DashboardResult => ({ dashboard: null, shops: [], sessions: {}, errors: [] });

export function usePOSDashboardData(token: string | null, shopId: string) {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(false);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    setData(empty());
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const next = await loadDashboardData(token, shopId);
      if (request === version.current) setData(next);
    } catch (error) {
      if (request === version.current) setData({ ...empty(), errors: [error instanceof Error ? error.message : 'Could not load the POS overview'] });
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [token, shopId]);

  useEffect(() => {
    void refresh();
    return () => { version.current++; };
  }, [refresh]);

  return { ...data, loading, refresh };
}
