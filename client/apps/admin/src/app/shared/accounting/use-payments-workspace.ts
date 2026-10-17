'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  arApService,
  type PaymentDoc,
  type PaymentSide,
  type PaymentSummary,
} from '@/services/arAp.service';
const empty: PaymentSummary = {
  activeAmount: 0,
  allocated: 0,
  unallocated: 0,
  cancelledAmount: 0,
};
export function usePaymentsWorkspace(token: string, side: PaymentSide) {
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [summary, setSummary] = useState(empty);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    method: '',
    search: '',
    from: '',
    to: '',
    vendor: '',
  });
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const id = ++sequence.current;
    setPayments([]);
    setSummary(empty);
    setError('');
    if (!token) return;
    setLoading(true);
    try {
      const res = await arApService.payments(token, side, {
        ...filters,
        page,
        limit: 25,
      });
      if (id !== sequence.current) return;
      const max = res.pagination?.pages || 1;
      if (page > max) {
        setPage(max);
        return;
      }
      setPayments(res.data || []);
      setPages(max);
      setTotal(res.pagination?.total ?? res.data?.length ?? 0);
      setSummary(res.paymentSummary || empty);
    } catch (e) {
      if (id === sequence.current)
        setError(e instanceof Error ? e.message : 'Payments could not load');
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, [token, side, filters, page]);
  useEffect(() => {
    const counter = sequence;
    void load();
    return () => {
      counter.current++;
    };
  }, [load]);
  const filter = (change: Partial<typeof filters>) => {
    setPage(1);
    setFilters((value) => ({ ...value, ...change }));
  };
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const cancel = async (payment: PaymentDoc) => {
    if (
      saving.current ||
      payment.readOnly ||
      payment.batch ||
      payment.status !== 'active'
    )
      return false;
    saving.current = true;
    setBusy(true);
    try {
      await arApService.cancelPayment(token, side, payment._id);
      toast.success(
        side === 'customer'
          ? 'Receipt cancelled and reversed'
          : 'Payment cancelled and reversed'
      );
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancellation failed');
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return {
    payments,
    summary,
    page,
    pages,
    total,
    loading,
    error,
    filters,
    filter,
    setPage,
    load,
    busy,
    cancel,
  };
}
