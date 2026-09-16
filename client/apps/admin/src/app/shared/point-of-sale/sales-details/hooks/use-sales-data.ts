'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import { isTokenExpired, toTsUtc } from '../helpers';
import { flattenOrders } from '../lib/flatten-orders';
import { groupRows } from '../lib/group-rows';
import type {
  PosOrder,
  LineRow,
  GroupRow,
  GroupByKey,
  LineSortField,
  GroupSortField,
  StatusFilter,
  SalesSummary,
  VoidSummary,
  SelectOption,
} from '../types';

interface UseSalesDataParams {
  token: string | null;
  historyShop: string | null;
  statusFilter: StatusFilter;
  cashierFilter: string;
  methodFilter: string;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  debouncedSearch: string;
  lineSortField: LineSortField;
  lineSortDir: 'asc' | 'desc';
  groupSortField: GroupSortField;
  groupSortDir: 'asc' | 'desc';
  viewMode: 'lines' | 'grouped';
  groupBy: GroupByKey;
}

export function useSalesData(params: UseSalesDataParams) {
  const {
    token, historyShop, statusFilter, cashierFilter, methodFilter,
    dateFrom, dateTo, timeFrom, timeTo, debouncedSearch,
    lineSortField, lineSortDir, groupSortField, groupSortDir,
    groupBy,
  } = params;

  const { status: sessionStatus } = useSession();
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);

  // ── Fetch ──
  const fetchOrders = useCallback(
    (all = false) => {
      if (sessionStatus === 'loading') return;
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      posApi
        .getAllOrders(token, { limit: all ? 2000 : 500, shopId: historyShop ?? undefined })
        .then((data) => {
          const rows = (data || []) as PosOrder[];
          setOrders(rows);
          setTruncated(!all && rows.length === 500);
        })
        .catch(() => setError('Failed to load orders. Please try again.'))
        .finally(() => setLoading(false));
    },
    [token, sessionStatus, historyShop]
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const refetch = useCallback(() => fetchOrders(false), [fetchOrders]);
  const refetchAll = useCallback(() => fetchOrders(true), [fetchOrders]);

  // ── Flatten orders → LineRow[] (FIX 1: server-authoritative gross) ──
  const allRows = useMemo<LineRow[]>(() => flattenOrders(orders), [orders]);

  const hasCostData = useMemo(
    () => allRows.some((r) => r.costPrice > 0),
    [allRows]
  );

  const cashiers = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.cashier))).sort(),
    [allRows]
  );

  const cashierOptions = useMemo<SelectOption[]>(
    () => cashiers.map((c) => ({ value: c, label: c })),
    [cashiers]
  );

  // ── Status counts (distinct orders) ──
  const statusCounts = useMemo(() => {
    const seen = new Map<string, boolean>();
    for (const r of allRows) {
      if (!seen.has(r.orderId)) seen.set(r.orderId, r.isVoided);
    }
    let active = 0;
    let voided = 0;
    seen.forEach((v) => {
      if (v) voided++;
      else active++;
    });
    return { all: seen.size, active, voided };
  }, [allRows]);

  // ── FIX 3: local-time date filtering via toTsUtc ──
  const filteredBase = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return allRows.filter((r) => {
      if (cashierFilter && r.cashier !== cashierFilter) return false;
      if (methodFilter && r.paymentMethod !== methodFilter) return false;
      if (dateFrom) {
        const startTs = toTsUtc(dateFrom, timeFrom);
        if (new Date(r.date).getTime() < startTs) return false;
      }
      if (dateTo) {
        const endTs = toTsUtc(dateTo, timeTo) + 59_000;
        if (new Date(r.date).getTime() > endTs) return false;
      }
      if (q) {
        const hit =
          r.product.toLowerCase().includes(q) ||
          r.variant.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.subcategory.toLowerCase().includes(q) ||
          r.brand.toLowerCase().includes(q) ||
          r.cashier.toLowerCase().includes(q) ||
          r.orderNumber.toLowerCase().includes(q) ||
          r.receiptNumber.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [
    allRows, cashierFilter, methodFilter,
    dateFrom, dateTo, timeFrom, timeTo, debouncedSearch,
  ]);

  // ── Active / Voided split ──
  const activeRows = useMemo(
    () => filteredBase.filter((r) => !r.isVoided),
    [filteredBase]
  );
  const voidedRows = useMemo(
    () => filteredBase.filter((r) => r.isVoided),
    [filteredBase]
  );

  // ── Status-filtered for table display ──
  const filtered = useMemo(() => {
    if (statusFilter === 'active') return activeRows;
    if (statusFilter === 'voided') return voidedRows;
    return filteredBase;
  }, [filteredBase, activeRows, voidedRows, statusFilter]);

  // ── Sort (line view) ──
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[lineSortField] as string | number;
      const bv = b[lineSortField] as string | number;
      if (typeof av === 'number' && typeof bv === 'number')
        return lineSortDir === 'asc' ? av - bv : bv - av;
      return lineSortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, lineSortField, lineSortDir]);

  // ── Grouped ──
  const grouped = useMemo<GroupRow[]>(
    () => groupRows(filteredBase, groupBy, groupSortField, groupSortDir),
    [filteredBase, groupBy, groupSortField, groupSortDir]
  );

  // ── FIX 2: summary computed from activeRows only ──
  const summary = useMemo<SalesSummary>(() => {
    const rows = activeRows;
    const revenue = rows.reduce((s, r) => s + r.subtotal, 0);
    const items = rows.reduce((s, r) => s + r.qty, 0);
    const discount = rows.reduce((s, r) => s + r.discount, 0);
    const gross = rows.reduce((s, r) => s + r.gross, 0);
    const profit = rows.reduce((s, r) => s + r.profit, 0);
    const orderIds = new Set(rows.map((r) => r.orderId));
    const cnt = orderIds.size;
    return {
      revenue,
      items,
      discount,
      gross,
      profit,
      orders: cnt,
      avgOrder: cnt > 0 ? revenue / cnt : 0,
    };
  }, [activeRows]);

  const voidSummary = useMemo<VoidSummary>(
    () => ({
      count: voidedRows.length,
      revenue: voidedRows.reduce((s, r) => s + r.subtotal, 0),
    }),
    [voidedRows]
  );

  // ── FIX 4: memoized distinct order count ──
  const distinctOrderCount = useMemo(
    () => new Set(filteredBase.map((r) => r.orderId)).size,
    [filteredBase]
  );

  return {
    orders,
    allRows,
    filteredBase,
    activeRows,
    voidedRows,
    sorted,
    grouped,
    summary,
    voidSummary,
    statusCounts,
    hasCostData,
    cashiers,
    cashierOptions,
    loading,
    error,
    truncated,
    refetch,
    refetchAll,
    distinctOrderCount,
  };
}