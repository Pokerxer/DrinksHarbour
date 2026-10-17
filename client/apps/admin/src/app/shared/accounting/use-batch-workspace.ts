'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  arApService,
  type BatchPayment,
  type BatchSummary,
  type PaymentSide,
} from '@/services/arAp.service';
export type BatchFilters = {
  status: string;
  account: string;
  search: string;
  from: string;
  to: string;
};
export const emptyBatchFilters: BatchFilters = {
  status: '',
  account: '',
  search: '',
  from: '',
  to: '',
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Batch request could not be completed';
export function useBatchWorkspace(token: string, side: PaymentSide) {
  const [batches, setBatches] = useState<BatchPayment[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [filters, setFilters] = useState(emptyBatchFilters);
  const [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [mustRefresh, setMustRefresh] = useState(false);
  const sequence = useRef(0),
    saving = useRef(false);
  const load = useCallback(async () => {
    const id = ++sequence.current;
    setBatches([]);
    setSummary(null);
    setError('');
    setLoading(true);
    if (!token) {
      setLoading(false);
      return;
    }
    if (filters.from && filters.to && filters.from > filters.to) {
      setError('End date must be on or after start date');
      setLoading(false);
      return;
    }
    try {
      const result = await arApService.batches(token, {
        direction: side,
        ...filters,
        page,
        limit: 25,
      });
      if (id !== sequence.current) return;
      const max = result.pagination?.pages || 1;
      if (page > max) {
        setPage(max);
        return;
      }
      setBatches(result.data || []);
      setSummary(result.batchSummary || null);
      setPages(max);
      setTotal(result.pagination?.total ?? result.data.length);
      setMustRefresh(false);
    } catch (e) {
      if (id === sequence.current) setError(message(e));
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, [token, side, filters, page]);
  useEffect(() => {
    const requestSequence = sequence;
    void load();
    return () => {
      requestSequence.current++;
    };
  }, [load]);
  const update = (values: BatchFilters) => {
    setFilters(values);
    setPage(1);
  };
  const act = async (batch: BatchPayment, action: 'deposit' | 'cancel') => {
    if (
      !token ||
      loading ||
      error ||
      mustRefresh ||
      saving.current ||
      batch.status !== 'open' ||
      (action === 'deposit' && batch.needsReview)
    )
      return false;
    saving.current = true;
    setBusy(true);
    try {
      if (action === 'deposit')
        await arApService.depositBatch(token, batch._id);
      else await arApService.cancelBatch(token, batch._id);
      toast.success(
        action === 'deposit'
          ? 'Batch reconciliation completed'
          : 'Batch cancelled; payments released'
      );
      await load();
      return true;
    } catch (e) {
      setMustRefresh(true);
      toast.error(`${message(e)}. Refresh batches before trying again.`);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return {
    batches,
    summary,
    filters,
    update,
    page,
    pages,
    total,
    setPage,
    loading,
    error,
    busy,
    mustRefresh,
    load,
    act,
  };
}
