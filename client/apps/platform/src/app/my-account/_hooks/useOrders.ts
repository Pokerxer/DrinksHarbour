'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Order, FiltersState, PaginationData } from '../_types';
import { ORDERS_PAGE_SIZE } from '../_constants';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UseOrdersReturn {
  orders: Order[];
  loading: boolean;
  error: string | null;
  pagination: PaginationData;
  filters: FiltersState;
  setFilters: (f: Partial<FiltersState>) => void;
  goToPage: (page: number) => void;
  refetch: () => void;
}

export function useOrders(token: string | null): UseOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, pageSize: ORDERS_PAGE_SIZE, total: 0, totalPages: 0 });
  const [filters, setFiltersState] = useState<FiltersState>({ status: 'all', dateFrom: '', dateTo: '' });

  const setFilters = useCallback((f: Partial<FiltersState>) => {
    setFiltersState(prev => ({ ...prev, ...f }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page));
      params.set('limit', String(ORDERS_PAGE_SIZE));
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);

      const res = await fetchWithAuth(`${API_URL}/api/orders/my-orders?${params}`);
      if (!res.ok) { throw new Error('Failed to fetch orders'); }
      const data = await res.json();
      const ordersData = data.data?.orders || data.orders || [];
      const pagData = data.data?.pagination || data.pagination;
      setOrders(ordersData);
      if (pagData) setPagination(pagData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token, pagination.page, filters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const goToPage = useCallback((p: number) => {
    setPagination(prev => ({ ...prev, page: p }));
  }, []);

  return { orders, loading, error, pagination, filters, setFilters, goToPage, refetch: fetchOrders };
}

// ── Single order detail ────────────────────────────────────────────────────────

export function useOrderDetail(token: string | null, id: string | null) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/orders/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Order not found');
      setOrder(data.data?.order || data.order || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load order');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const cancel = useCallback(async () => {
    if (!token || !id) return { ok: false, message: 'Not authenticated' };
    try {
      const res = await fetchWithAuth(`${API_URL}/api/orders/${id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || 'Cancellation failed' };
      await fetchOrder();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }, [token, id, fetchOrder]);

  return { order, loading, error, refetch: fetchOrder, cancel };
}
