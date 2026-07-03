'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GiftCardItem, GiftCardTransaction } from '../_types';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UseGiftCardsReturn {
  cards: GiftCardItem[];
  loading: boolean;
  error: string | null;
  purchase: (data: { amount: number; recipient?: { email?: string; name?: string; message?: string }; design?: { templateId?: string; theme?: string } }) => Promise<{ ok: boolean; authUrl?: string; reference?: string; giftCardId?: string; message?: string }>;
  verifyPurchase: (reference: string, giftCardId: string) => Promise<{ ok: boolean; code?: string; balance?: number; status?: string; message?: string; alreadyIssued?: boolean }>;
  refresh: () => Promise<void>;
}

export function useGiftCards(token: string | null): UseGiftCardsReturn {
  const [cards, setCards] = useState<GiftCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/gift-cards`);
      if (!res.ok) throw new Error('Failed to load gift cards');
      const data = await res.json();
      setCards(data.data ?? data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const purchase = useCallback(async (body) => {
    if (!token) return { ok: false, message: 'Not authenticated' };
    try {
      const res = await fetchWithAuth(`${API_URL}/api/gift-cards/purchase`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || 'Failed to start purchase' };
      const payload = data.data ?? data;
      return { ok: true, authUrl: payload.authorizationUrl, reference: payload.reference, giftCardId: payload.giftCardId };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }, [token]);

  const verifyPurchase = useCallback(async (reference, giftCardId) => {
    if (!token) return { ok: false, message: 'Not authenticated' };
    try {
      const res = await fetchWithAuth(`${API_URL}/api/gift-cards/purchase/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference, giftCardId }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || 'Verification failed' };
      const payload = data.data ?? data;
      await refresh();
      return { ok: true, code: payload.code, balance: payload.balance, status: payload.status, alreadyIssued: payload.alreadyIssued };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }, [token, refresh]);

  return { cards, loading, error, purchase, verifyPurchase, refresh };
}

interface UseGiftCardDetailReturn {
  card: (GiftCardItem & { summary?: any }) | null;
  transactions: GiftCardTransaction[];
  loading: boolean;
  error: string | null;
  redeem: (id: string, amount: number) => Promise<{ ok: boolean; cardBalance?: number; walletBalance?: number; message?: string }>;
  refresh: () => Promise<void>;
}

export function useGiftCardDetail(token: string | null, id: string | null): UseGiftCardDetailReturn {
  const [card, setCard] = useState<(GiftCardItem & { summary?: any }) | null>(null);
  const [transactions, setTransactions] = useState<GiftCardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/gift-cards/${id}`);
      if (!res.ok) throw new Error('Failed to load gift card');
      const data = await res.json();
      const payload = data.data ?? data;
      setCard(payload);
      setTransactions(payload.transactions || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { refresh(); }, [refresh]);

  const redeem = useCallback(async (cardId, amount) => {
    if (!token) return { ok: false, message: 'Not authenticated' };
    try {
      const res = await fetchWithAuth(`${API_URL}/api/gift-cards/${cardId}/redeem`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || 'Redemption failed' };
      const payload = data.data ?? data;
      await refresh();
      return { ok: true, cardBalance: payload.cardBalance, walletBalance: payload.walletBalance };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }, [token, refresh]);

  return { card, transactions, loading, error, redeem, refresh };
}