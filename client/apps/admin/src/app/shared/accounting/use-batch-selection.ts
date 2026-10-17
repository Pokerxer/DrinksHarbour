'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  arApService,
  type BatchAccount,
  type BatchMember,
  type PaymentSide,
} from '@/services/arAp.service';
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Eligible payments could not load';
export function useBatchSelection(token: string, side: PaymentSide) {
  const [account, setAccount] = useState<BatchAccount>(
    side === 'customer' ? '1000' : '1100'
  );
  const [search, setSearch] = useState(''),
    [rows, setRows] = useState<BatchMember[]>([]),
    [selected, setSelected] = useState(new Map<string, BatchMember>());
  const [page, setPage] = useState(0),
    [pages, setPages] = useState(1),
    [loading, setLoading] = useState(true),
    [checking, setChecking] = useState(false),
    [error, setError] = useState(''),
    [reviewIssue, setReviewIssue] = useState('');
  const sequence = useRef(0),
    retryPage = useRef(1),
    identity = useRef('');
  const scope = `${token}:${side}:${account}`;
  identity.current = scope;
  const load = useCallback(
    async (next = 1) => {
      const id = ++sequence.current;
      retryPage.current = next;
      setLoading(true);
      setError('');
      if (next === 1) {
        setRows([]);
        setPage(0);
      }
      if (!token) {
        setError('Sign in to select payments');
        setLoading(false);
        return false;
      }
      try {
        const result = await arApService.unbatched(token, side, {
          account,
          search,
          page: next,
          limit: 100,
        });
        if (id !== sequence.current) return false;
        const incoming = result.data || [];
        setRows((old) =>
          next === 1
            ? incoming
            : [
                ...old,
                ...incoming.filter(
                  (row) => !old.some((item) => item.key === row.key)
                ),
              ]
        );
        setPage(next);
        setPages(result.pagination?.pages || 1);
        return true;
      } catch (e) {
        if (id === sequence.current) setError(message(e));
        return false;
      } finally {
        if (id === sequence.current) setLoading(false);
      }
    },
    [token, side, account, search]
  );
  useEffect(() => {
    const requestSequence = sequence;
    void load();
    return () => {
      requestSequence.current++;
    };
  }, [load]);
  const changeAccount = (next: BatchAccount) => {
    setSelected(new Map());
    setReviewIssue('');
    setAccount(next);
    setSearch('');
  };
  const toggle = (member: BatchMember) =>
    setSelected((old) => {
      const next = new Map(old);
      if (next.has(member.key)) next.delete(member.key);
      else next.set(member.key, member);
      return next;
    });
  const clear = () => {
    setSelected(new Map());
    setReviewIssue('');
  };
  const refresh = async () => {
    const currentScope = scope;
    setChecking(true);
    setReviewIssue('');
    try {
      if (!(await load(1)) || identity.current !== currentScope) return false;
      if (selected.size) {
        const result = await arApService.previewBatchSelection(token, {
          direction: side,
          account,
          paymentIds: Array.from(selected.keys()),
        });
        if (identity.current !== currentScope) return false;
        if (
          Array.from(selected.values()).some((old) => {
            const now = result.data.find((row) => row.key === old.key);
            return (
              !now ||
              ['amount', 'capturedAmount', 'refundedAmount'].some(
                (field) =>
                  Math.abs(now[field as 'amount'] - old[field as 'amount']) >
                  0.001
              )
            );
          })
        )
          setReviewIssue(
            'Selected payments changed or are no longer eligible. Clear selections and choose the current amounts again.'
          );
      }
      return true;
    } catch (e) {
      if (identity.current === currentScope) setReviewIssue(message(e));
      return false;
    } finally {
      if (identity.current === currentScope) setChecking(false);
    }
  };
  return {
    account,
    changeAccount,
    search,
    setSearch,
    rows,
    selected,
    toggle,
    clear,
    loading,
    checking,
    error,
    reviewIssue,
    hasMore: page < pages,
    loadMore: () => {
      void load(page + 1);
    },
    retry: () => {
      void load(retryPage.current);
    },
    refresh,
  };
}
