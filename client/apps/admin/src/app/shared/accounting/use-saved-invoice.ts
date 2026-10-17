'use client';
import { useEffect, useRef, useState } from 'react';
import { arApService, type SavedInvoice } from '@/services/arAp.service';

export function useSavedInvoice(token: string, id: string) {
  const [version, reload] = useState(0);
  const [invoice, setInvoice] = useState<SavedInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setInvoice(null);
    arApService
      .invoice(token, id)
      .then((body) => {
        if (current) setInvoice(body.data);
      })
      .catch((err) => {
        if (current)
          setError(
            err instanceof Error ? err.message : 'Invoice could not load'
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [token, id, version]);
  const reconcile = async () => {
    if (pending.current || loading) return;
    pending.current = true;
    setReconciling(true);
    setActionError('');
    try {
      await arApService.reconcileInvoice(token, id);
      if (mounted.current) reload((v) => v + 1);
    } catch (err) {
      if (mounted.current)
        setActionError(
          err instanceof Error ? err.message : 'Reconciliation could not finish'
        );
    } finally {
      pending.current = false;
      if (mounted.current) setReconciling(false);
    }
  };
  return {
    invoice,
    loading,
    error,
    actionError,
    reconciling,
    reconcile,
    refresh: () => {
      if (!pending.current && !loading) {
        setActionError('');
        reload((v) => v + 1);
      }
    },
  };
}
