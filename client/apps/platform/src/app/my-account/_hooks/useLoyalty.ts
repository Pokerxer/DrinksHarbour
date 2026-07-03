'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LoyaltyData, LoyaltyTransaction } from '../_types';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UseLoyaltyReturn {
  loyalty: LoyaltyData | null;
  loading: boolean;
  error: string | null;
  transactions: LoyaltyTransaction[];
  txLoading: boolean;
  txPage: number;
  txTotalPages: number;
  fetchTransactions: (page?: number) => Promise<void>;
  redeem: (points: number) => Promise<{ ok: boolean; pointsBalance?: number; walletBalance?: number; amountCredited?: number; message?: string }>;
  getReferralCode: () => Promise<{ ok: boolean; code?: string; link?: string; message?: string }>;
  applyReferral: (code: string) => Promise<{ ok: boolean; bonusPoints?: number; pointsBalance?: number; message?: string }>;
  refresh: () => Promise<void>;
}

export function useLoyalty(token: string | null): UseLoyaltyReturn {
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/loyalty`);
      if (!res.ok) throw new Error('Failed to load loyalty status');
      const data = await res.json();
      setLoyalty(data.data ?? data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const fetchTransactions = useCallback(async (page = 1) => {
    if (!token) return;
    setTxLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/loyalty/transactions?page=${page}&limit=20`);
      if (!res.ok) throw new Error('Failed to load transactions');
      const data = await res.json();
      const payload = data.data ?? data;
      setTransactions(payload.items || []);
      setTxPage(payload.pagination?.page || 1);
      setTxTotalPages(payload.pagination?.totalPages || 1);
    } catch { /* keep existing */ }
    finally { setTxLoading(false); }
  }, [token]);

  const redeem = useCallback(async (points) => {
    if (!token) return { ok: false, message: 'Not authenticated' };
    try {
      const res = await fetchWithAuth(`${API_URL}/api/loyalty/redeem`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || 'Redemption failed' };
      const payload = data.data ?? data;
      await refresh();
      return { ok: true, pointsBalance: payload.pointsBalance, walletBalance: payload.walletBalance, amountCredited: payload.amountCredited };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }, [token, refresh]);

  const getReferralCode = useCallback(async () => {
    if (!token) return { ok: false, message: 'Not authenticated' };
    try {
      const res = await fetchWithAuth(`${API_URL}/api/loyalty/referral-code`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || 'Failed to generate code' };
      const payload = data.data ?? data;
      await refresh();
      return { ok: true, code: payload.code, link: payload.link };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }, [token, refresh]);

  const applyReferral = useCallback(async (code) => {
    if (!token) return { ok: false, message: 'Not authenticated' };
    try {
      const res = await fetchWithAuth(`${API_URL}/api/loyalty/apply-referral`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || 'Invalid referral code' };
      const payload = data.data ?? data;
      await refresh();
      return { ok: true, bonusPoints: payload.bonusPoints, pointsBalance: payload.pointsBalance };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }, [token, refresh]);

  return { loyalty, loading, error, transactions, txLoading, txPage, txTotalPages, fetchTransactions, redeem, getReferralCode, applyReferral, refresh };
}