'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  arApService,
  type CreditNote,
  type CreditNoteSummary,
} from '@/services/arAp.service';
const emptySummary: CreditNoteSummary = {
  count: 0,
  postedTotal: 0,
  appliedTotal: 0,
  available: 0,
  draftTotal: 0,
};
export function useCreditNotes(token: string) {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [summary, setSummary] = useState<CreditNoteSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    from: '',
    to: '',
  });
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setNotes([]);
    setSummary(emptySummary);
    setError('');
    if (!token) return;
    setLoading(true);
    try {
      const res = await arApService.creditNotes(token, {
        ...filters,
        page,
        limit: 25,
      });
      if (id !== request.current) return;
      const count = res.pagination?.total ?? res.data?.length ?? 0;
      const maxPage = res.pagination?.pages ?? 1;
      if (page > maxPage) {
        setPage(maxPage);
        return;
      }
      setNotes(res.data ?? []);
      setTotal(count);
      setPages(maxPage);
      setSummary(res.summary ?? { ...emptySummary, count });
    } catch (e) {
      if (id === request.current)
        setError(
          e instanceof Error ? e.message : 'Credit notes could not load'
        );
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [token, page, filters]);
  useEffect(() => {
    const counter = request;
    void load();
    return () => {
      counter.current++;
    };
  }, [load]);
  const filter = (changes: Partial<typeof filters>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...changes }));
  };
  const [busy, setBusy] = useState(false);
  const mutate = async (note: CreditNote, action: 'post' | 'cancel') => {
    if (busy || !token) return false;
    setBusy(true);
    try {
      if (action === 'post') await arApService.postCreditNote(token, note._id);
      else await arApService.cancelCreditNote(token, note._id);
      toast.success(
        action === 'post'
          ? 'Credit note posted'
          : note.status === 'draft'
            ? 'Draft cancelled'
            : 'Credit note cancelled and reversed'
      );
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Credit action failed');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return {
    notes,
    summary,
    loading,
    error,
    page,
    pages,
    total,
    filters,
    filter,
    setPage,
    load,
    busy,
    mutate,
  };
}
