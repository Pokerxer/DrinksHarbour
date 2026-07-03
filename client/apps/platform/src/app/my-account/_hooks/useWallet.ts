'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WalletData, WalletTransaction } from '../_types';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UseWalletReturn {
  wallet: WalletData | null;
  loading: boolean;
  error: string | null;
  transactions: WalletTransaction[];
  txLoading: boolean;
  txPage: number;
  txTotalPages: number;
  fetchTransactions: (page?: number, opts?: { type?: string; from?: string; to?: string }) => Promise<void>;
  fundWallet: (amount: number) => Promise<{ ok: boolean; authUrl?: string; reference?: string; message?: string }>;
  verifyFunding: (reference: string) => Promise<{ ok: boolean; balance?: number; message?: string; alreadyCredited?: boolean }>;
  refresh: () => Promise<void>;
}

export function useWallet(token: string | null): UseWalletReturn {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/wallet`);
      if (!res.ok) throw new Error('Failed to load wallet');
      const data = await res.json();
      setWallet(data.data ?? data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const fetchTransactions = useCallback(async (page = 1, opts: { type?: string; from?: string; to?: string } = {}) => {
    if (!token) return;
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (opts.type && opts.type !== 'all') params.set('type', opts.type);
      if (opts.from) params.set('from', opts.from);
      if (opts.to) params.set('to', opts.to);
      const res = await fetchWithAuth(`${API_URL}/api/wallet/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load transactions');
      const data = await res.json();
      const payload = data.data ?? data;
      setTransactions(payload.items || []);
      setTxPage(payload.pagination?.page || 1);
      setTxTotalPages(payload.pagination?.totalPages || 1);
    } catch { /* keep existing */ }
    finally { setTxLoading(false); }
  }, [token]);

  const fundWallet = useCallback(async (amount: number) => {
    if (!token) return { ok: false, message: 'Not authenticated' };
    try {
      const res = await fetchWithAuth(`${API_URL}/api/wallet/fund`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || 'Failed to initialize funding' };
      const payload = data.data ?? data;
      return { ok: true, authUrl: payload.authorizationUrl, reference: payload.reference };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }, [token]);

  const verifyFunding = useCallback(async (reference: string) => {
    if (!token) return { ok: false, message: 'Not authenticated' };
    try {
      const res = await fetchWithAuth(`${API_URL}/api/wallet/fund/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || 'Verification failed' };
      const payload = data.data ?? data;
      // Refresh the wallet balance after a successful funding.
      await refresh();
      return { ok: true, balance: payload.balance, alreadyCredited: payload.alreadyCredited };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }, [token, refresh]);

  return { wallet, loading, error, transactions, txLoading, txPage, txTotalPages, fetchTransactions, fundWallet, verifyFunding, refresh };
}