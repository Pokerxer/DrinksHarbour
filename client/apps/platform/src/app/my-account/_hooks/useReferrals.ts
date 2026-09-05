'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ReferralsPayload } from '../_types';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export function useReferrals(token: string | null) {
  const [data, setData] = useState<ReferralsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/referrals`);
      if (!res.ok) throw new Error('Failed to load referrals');
      const json = await res.json();
      setData(json.data ?? json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load referrals');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}