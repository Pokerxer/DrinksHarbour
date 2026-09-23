'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadHistory, type HistoryRecord } from './history-data';
export function useHistoryData(url: string, token: string) {
  const [rows, setRows] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const fetchData = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError('');
    setRows([]);
    try {
      const result = await loadHistory(url, token, controller.signal);
      if (!controller.signal.aborted) setRows(result);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : 'Unable to load history. Please retry.'
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [url, token]);
  useEffect(() => {
    void fetchData();
    return () => active.current?.abort();
  }, [fetchData]);
  return { rows, loading, error, fetchData };
}
